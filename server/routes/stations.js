// Browse + Detail (docs/plan.md, Step 3):
//   GET /api/stations?q=&connector=&access=           station list (Browse)
//   GET /api/stations/:id                             one station and its plugs (Detail)
//   GET /api/stations/:id/availability?date=&connectorId=[&battery_kwh=&max_kw=&start_pct=&target_pct=]
//                                                     open start times (revenue feature 1)
// Extra, for the report form and old links:
//   GET /api/products?q=&connector=&access=           every plug as its own row
//   GET /api/products/:id                             one plug
const express = require('express');
const repo = require('../repositories/products');                        // reads stations, plugs and slot holds
const { formatProduct, formatStationForMap, pesos } = require('../format'); // DB document → JSON for the pages
const { openStartTimes } = require('../availability');                    // which start times are still open
const { planCharge, isOffPeak } = require('../pricing');                  // energy, time window and bill; off-peak
const { toId, validateCharge, hasErrors, errorBody } = require('../validate'); // ids and the car/charge inputs
const { manila, manilaMidnight, addMinutes, isValidDateString, manilaClock } = require('../time'); // Manila time helpers
const { CONNECTORS, BOOKING_DAYS_AHEAD, SLOT_MINUTES, PAYMENT_METHODS } = require('../config');  // plug types and limits

const router = express.Router();

// Turns the ?connector= filter into the code stored in the database.
// Accepts a code ("CCS2", "Type2") or a label ("Type 2 AC"), ignoring spaces and capitals.
// Returns the code, '' if no filter was given, or null if it's not a known plug type.
function parseConnector(value) {
  if (!value) return '';
  const v = String(value).toLowerCase().replace(/\s+/g, '');
  const match = Object.entries(CONNECTORS).find(
    ([code, label]) => code.toLowerCase() === v || label.toLowerCase().replace(/\s+/g, '') === v
  );
  return match ? match[0] : null;
}

// Reads and checks the filters from the URL: ?q=, ?connector=, ?access=free|paid
// (?pricing= is accepted as an older name for ?access=).
// Returns { error } if a filter is invalid, otherwise the cleaned-up filters.
function parseFilters(query) {
  const connector = parseConnector(query.connector);
  if (connector === null) return { error: `connector must be one of: ${Object.keys(CONNECTORS).join(', ')}` };
  const raw = query.access || query.pricing;
  const pricing = raw ? String(raw).toUpperCase() : '';
  if (pricing && !['FREE', 'PAID'].includes(pricing)) return { error: 'access must be free or paid' };
  const q = typeof query.q === 'string' ? query.q.trim().slice(0, 60) : '';
  return { q, connector, pricing };
}

// Fetch → Transform: loads the plugs and which are in use right now (both at the same time),
// then shapes each one, including "stock" = 1 if free now, 0 if in use.
async function loadProducts(filters) {
  const now = new Date();
  const [rows, active] = await Promise.all([repo.listProducts(filters), repo.activeBookingCounts(now)]);
  return rows.map((p) => formatProduct(p, active.get(p.id), now));
}

// GET /api/stations: one summary per station (free plugs now, plug types, price, location).
// 200 even when nothing matches (Challenge 1, test 6) · 400 bad filter.
router.get('/stations', async (req, res) => {
  const filters = parseFilters(req.query);
  if (filters.error) return res.status(400).json({ error: filters.error });
  const products = await loadProducts(filters);
  const byStation = new Map();
  for (const p of products) {
    if (!byStation.has(p.station_id)) byStation.set(p.station_id, []);
    byStation.get(p.station_id).push(p);
  }
  res.status(200).json([...byStation.values()].map(formatStationForMap));
});

// GET /api/stations/:id: one station with all its plugs and which are free now. 200 · 404.
router.get('/stations/:id', async (req, res) => {
  const id = toId(req.params.id);
  const found = id && (await repo.getStationWithPlugs(id));
  if (!found) return res.status(404).json({ error: 'Station not found' });
  const now = new Date();
  const active = await repo.activeBookingCounts(now);
  const plugs = found.plugs.map((p) => formatProduct(p, active.get(p.id), now));
  res.status(200).json({ ...formatStationForMap(plugs), area: found.station.area, description: found.station.description, open_now: plugs[0].open_now, plugs });
});

// The four car/charge parameters. If none are sent, availability lists open single 30-minute slots.
const CHARGE_PARAMS = ['battery_kwh', 'max_kw', 'start_pct', 'target_pct'];

// GET /api/stations/:id/availability?date=YYYY-MM-DD&connectorId=UPTC-DC1
//   [&battery_kwh=60&max_kw=88&start_pct=20&target_pct=80]
// Revenue feature 1: only start times that are open, computed from saved slot holds.
// With the car and battery %, each start time has room for the whole charge, and the
// response includes the server's price preview. 200 · 400 bad date or input · 404 unknown station/plug.
router.get('/stations/:id/availability', async (req, res) => {
  const stationId = toId(req.params.id);
  const found = stationId && (await repo.getStationWithPlugs(stationId));
  if (!found) return res.status(404).json({ error: 'Station not found' });

  const connectorId = req.query.connectorId;
  if (!connectorId) return res.status(400).json({ error: 'connectorId is required, e.g. ?connectorId=' + found.plugs[0].id });
  const product = found.plugs.find((p) => p.id === connectorId);
  if (!product) return res.status(404).json({ error: `Connector ${connectorId} is not at this station` });

  // The date must be today or within the next 7 days. Defaults to today.
  const now = new Date();
  const today = manila(now).date;
  const lastDay = manila(addMinutes(now, (BOOKING_DAYS_AHEAD - 1) * 24 * 60)).date;
  const date = req.query.date || today;
  if (!isValidDateString(date) || date < today || date > lastDay) {
    return res.status(400).json({ error: `date must be between ${today} and ${lastDay}` });
  }

  // Car and battery % (optional as a group): they decide how long a free window is needed
  const withCharge = CHARGE_PARAMS.some((k) => req.query[k] !== undefined);
  const errors = {};
  const car = withCharge ? validateCharge(req.query, errors) : null;
  if (hasErrors(errors)) return res.status(400).json(errorBody(errors));

  // e.g. 60 kWh battery 20% → 80% = 36 kWh; at min(50 kW plug, 88 kW car) = 50 kW → 44 min → 2 slots.
  // The price preview comes from the same pricing.js the booking uses (paid with a wallet).
  const dayStart = manilaMidnight(date);
  const plan = (slotStart) => planCharge({
    ...car, chargerKw: product.power_kw, pricePerKwhCents: product.price_per_kwh_cents, slotStart, paymentMethod: PAYMENT_METHODS[0],
  });
  const preview = car ? plan(dayStart) : null;
  const slotCount = preview ? preview.slotCount : 1;

  // That day's held slots on this plug (plus extra time for a charge that runs past midnight)
  const orders = await repo.bookingsOverlapping(product.id, dayStart, addMinutes(dayStart, 24 * 60 + slotCount * SLOT_MINUTES));
  const starts = openStartTimes({ product, orders, dateStr: date, slotCount, now });

  res.status(200).json({
    station_id: stationId,
    connector_id: product.id,
    date,
    slot_count: slotCount,
    kwh: preview ? preview.kwh : null,
    charge_kw: preview ? preview.speedKw : null,
    charging_minutes: preview ? preview.minutes : null,
    estimate: preview ? {
      charging: pesos(preview.bill.chargingCents),
      reservation_fee: pesos(preview.bill.reservationFeeCents),
      deposit: pesos(preview.bill.depositCents),
      total: pesos(preview.bill.totalCents),
    } : null,
    starts: starts.map((s) => ({
      time: manilaClock(s.start),           // e.g. '14:30' (Manila time)
      slot_start: s.start.toISOString(),    // exact time, sent back when booking
      slot_end: s.end.toISOString(),
      off_peak: isOffPeak(s.start),         // true = 2× Watt Credits
      ...(preview ? { points_earned: plan(s.start).bill.pointsEarned } : {}),
    })),
  });
});

// GET /api/products: every plug as its own row (used by the report form's dropdown). 200 · 400.
router.get('/products', async (req, res) => {
  const filters = parseFilters(req.query);
  if (filters.error) return res.status(400).json({ error: filters.error });
  res.status(200).json(await loadProducts(filters));
});

// GET /api/products/:id: one plug. 200 · 404 (Challenge 1, test 4).
router.get('/products/:id', async (req, res) => {
  const id = toId(req.params.id);
  const row = id && (await repo.getProduct(id));
  if (!row) return res.status(404).json({ error: 'Product not found' });
  const now = new Date();
  const active = await repo.activeBookingCounts(now);
  res.status(200).json(formatProduct(row, active.get(row.id), now));
});

module.exports = router;
