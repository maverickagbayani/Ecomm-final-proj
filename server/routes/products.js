// Browse + Detail: /api/products, /api/products/:id, /api/products/:id/availability, /api/stations (map)
const express = require('express');
const repo = require('../repositories/products');                        // reads chargers and their bookings
const { formatProduct, formatStationForMap } = require('../format');      // DB row → JSON for the pages
const { openStartTimes } = require('../availability');                    // which start times are still open
const { chargingWindow, isOffPeak } = require('../pricing');              // charge length; off-peak check
const { toPositiveInt } = require('../validate');                         // '7' → 7, 'abc' → null
const { toDb, manila, manilaMidnight, addMinutes, isValidDateString, manilaClock } = require('../time'); // Manila time helpers
const { CONNECTORS, BOOKING_DAYS_AHEAD, MAX_KWH } = require('../config');  // plug types and limits

// A small group of routes that server/routes/index.js plugs in under /api
const router = express.Router();

// Turns the ?connector= filter into the code stored in the database.
// Accepts a code ("CCS2", "Type2") or a label ("Type 2 AC"), ignoring spaces and capitals.
// Returns the code, '' if no filter was given, or null if it's not a known plug type.
function parseConnector(value) {
  if (!value) return '';
  const v = String(value).toLowerCase().replace(/\s+/g, '');   // 'Type 2 AC' → 'type2ac'
  const match = Object.entries(CONNECTORS).find(
    ([code, label]) => code.toLowerCase() === v || label.toLowerCase().replace(/\s+/g, '') === v
  );
  return match ? match[0] : null;
}

// Reads and checks the filters from the URL (?q=, ?connector=, ?pricing=).
// Returns { error } if a filter is invalid, otherwise the cleaned-up filters.
function parseFilters(query) {
  const connector = parseConnector(query.connector);
  if (connector === null) return { error: `connector must be one of: ${Object.keys(CONNECTORS).join(', ')}` };
  const pricing = query.pricing ? String(query.pricing).toUpperCase() : '';      // 'free' → 'FREE'
  if (pricing && !['FREE', 'PAID'].includes(pricing)) return { error: 'pricing must be FREE or PAID' };
  const q = typeof query.q === 'string' ? query.q.trim().slice(0, 60) : '';      // search text, max 60 characters
  return { q, connector, pricing };
}

// Fetch → Transform: loads the chargers and how many sockets are in use right now
// (both at the same time), then shapes each one for the page, including "stock" = free sockets now.
async function loadProducts(filters) {
  const now = new Date();
  const [rows, active] = await Promise.all([repo.listProducts(filters), repo.activeBookingCounts(toDb(now))]);
  return rows.map((p) => formatProduct(p, active.get(Number(p.id)), now));
}

// GET /api/products: the station list (Browse). Used by the stations page, home and directory.
// 400 if a filter is invalid. A search with no results is still 200 with [] (Challenge 1, test 6).
router.get('/products', async (req, res) => {
  const filters = parseFilters(req.query);
  if (filters.error) return res.status(400).json({ error: filters.error });
  res.status(200).json(await loadProducts(filters));
});

// GET /api/products/:id: one charger, for the station page. 404 if the id doesn't exist (Challenge 1, test 4).
router.get('/products/:id', async (req, res) => {
  const id = toPositiveInt(req.params.id);
  const row = id && (await repo.getProduct(id));       // only asks the database if the id is a valid number
  if (!row) return res.status(404).json({ error: 'Product not found' });
  const now = new Date();
  const active = await repo.activeBookingCounts(toDb(now));
  res.status(200).json(formatProduct(row, active.get(row.id), now));
});

// Revenue feature 1: only start times that are actually open, computed from saved bookings.
// GET /api/products/:id/availability?date=YYYY-MM-DD&kwh=20
// Used by the station page's "Open start times" dropdown.
router.get('/products/:id/availability', async (req, res) => {
  // The charger must exist (404 if not)
  const id = toPositiveInt(req.params.id);
  const product = id && (await repo.getProduct(id));
  if (!product) return res.status(404).json({ error: 'Product not found' });

  // The date must be today or within the next 7 days (400 if not). Defaults to today.
  const now = new Date();
  const today = manila(now).date;
  const lastDay = manila(addMinutes(now, (BOOKING_DAYS_AHEAD - 1) * 24 * 60)).date;
  const date = req.query.date || today;
  if (!isValidDateString(date) || date < today || date > lastDay) {
    return res.status(400).json({ error: `date must be between ${today} and ${lastDay}` });
  }
  // kWh decides how long the charge is, so how long a free window is needed. Defaults to 20.
  const kwh = req.query.kwh === undefined ? 20 : Number(req.query.kwh);
  if (!Number.isFinite(kwh) || kwh <= 0 || kwh > MAX_KWH) {
    return res.status(400).json({ error: `kwh must be a number from 0.1 to ${MAX_KWH}` });
  }

  // How many 30-minute slots this charge needs, e.g. 20 kWh on a 60 kW charger = 20 min = 1 slot
  const dayStart = manilaMidnight(date);
  const { minutes, slotCount } = chargingWindow(kwh, Number(product.power_kw), dayStart);
  // That day's bookings for this charger (plus extra time for a charge that runs past midnight)
  const orders = await repo.bookingsOverlapping(id, toDb(dayStart), toDb(addMinutes(dayStart, 24 * 60 + slotCount * 30)));
  // Every start time that is open, not in the past, and has a free socket for the whole charge
  const starts = openStartTimes({ product, orders, dateStr: date, slotCount, now });

  res.status(200).json({
    product_id: id,
    date,
    kwh,
    charging_minutes: minutes,
    slot_count: slotCount,
    starts: starts.map((s) => ({
      time: manilaClock(s.start),           // ex '14:30' (Manila time)
      slot_start: s.start.toISOString(),    // exact time, sent back when booking
      slot_end: s.end.toISOString(),
      free_sockets: s.freeSockets,          // fewest free sockets during the window
      off_peak: isOffPeak(s.start),         // true = 2× Watt Credits
    })),
  });
});

// GET /api/stations: station summaries for Zaira's map (frontend-map) Same filters as /api/products.
// The database has one row per charger, so this groups chargers by station
// and sends them in the same shape as her stations.json.
router.get('/stations', async (req, res) => {
  const filters = parseFilters(req.query);
  if (filters.error) return res.status(400).json({ error: filters.error });
  const products = await loadProducts(filters);
  // Group: station id → list of its chargers
  const byStation = new Map();
  for (const p of products) {
    if (!byStation.has(p.station_id)) byStation.set(p.station_id, []);
    byStation.get(p.station_id).push(p);
  }
  // One summary per station (total free sockets, plug types, cheapest price, location)
  res.status(200).json([...byStation.values()].map(formatStationForMap));
});

// Makes these routes available to server/routes/index.js
module.exports = router;