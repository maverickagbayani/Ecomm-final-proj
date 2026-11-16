// Stations and their plugs. Only this file queries the stations and slotholds collections for reading.
//
// The API calls one bookable plug a "product". Each plug is turned into a flat object
// (see toPlug) so availability.js, format.js and the routes don't need to know how
// MongoDB nests connectors inside stations.
const { Station, SlotHold } = require('../models');
const { SLOT_MINUTES } = require('../config');
const { addMinutes } = require('../time');

// One station document + one of its connectors → the flat "product" shape used everywhere else
function toPlug(station, c) {
  return {
    id: c.connectorId,
    station_id: station._id,
    label: c.label,
    connector: c.type,
    power_kw: c.kw,
    price_per_kwh_cents: station.pricePerKwhCents,
    sockets: 1, // one plug = one car at a time
    station_name: station.name,
    address: station.address,
    area: station.area,
    lat: station.location.coordinates[1],
    lng: station.location.coordinates[0],
    open_hour: station.openHour,
    close_hour: station.closeHour,
    description: station.description,
  };
}

// 'a.b' → 'a\.b', so a search for "St. Luke's" can't be read as a regular expression
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// All plugs, narrowed by the page's filters:
//   q         - search text, matched against station name, address or area
//   connector - plug type, e.g. 'CCS2'
//   pricing   - 'FREE' or 'PAID'
// Sorted by station name, then fastest plug first.
// Used by: GET /api/products, GET /api/stations (map), GET /api/metrics
async function listProducts({ q, connector, pricing } = {}) {
  const filter = {};
  if (q) {
    const re = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ name: re }, { address: re }, { area: re }];
  }
  if (connector) filter['connectors.type'] = connector;
  if (pricing === 'FREE') filter.pricePerKwhCents = 0;
  if (pricing === 'PAID') filter.pricePerKwhCents = { $gt: 0 };

  const stations = await Station.find(filter).sort({ name: 1 }).lean();
  const plugs = [];
  for (const s of stations) {
    const connectors = [...s.connectors].sort((a, b) => b.kw - a.kw);
    for (const c of connectors) if (!connector || c.type === connector) plugs.push(toPlug(s, c));
  }
  return plugs;
}

// One plug by its connector id (e.g. 'UPTC-DC1'), or null (the route then answers 404).
async function getProduct(id, session = null) {
  const station = await Station.findOne({ 'connectors.connectorId': id }).session(session).lean();
  if (!station) return null;
  return toPlug(station, station.connectors.find((c) => c.connectorId === id));
}

async function getStation(id) {
  return Station.findById(id).lean();
}

// One station and its plugs (fastest first), or null. Used by: GET /api/stations/:id
async function getStationWithPlugs(id) {
  const station = await Station.findById(id).lean();
  if (!station) return null;
  const plugs = [...station.connectors].sort((a, b) => b.kw - a.kw).map((c) => toPlug(station, c));
  return { station, plugs };
}

// How many plugs are held right now, per plug: a Map like { 'UPTC-DC1' => 1 }.
// Used to show "free now" on station lists.
async function activeBookingCounts(now) {
  const holds = await SlotHold.find({ start: { $lte: now, $gt: addMinutes(now, -SLOT_MINUTES) } }, { connectorId: 1 }).lean();
  const counts = new Map();
  for (const h of holds) counts.set(h.connectorId, (counts.get(h.connectorId) || 0) + 1);
  return counts;
}

// Held slots of one plug that overlap the window [from, to), as { slot_start, slot_end }.
// Used by: open start times (availability) and the 409 suggestions when booking.
async function bookingsOverlapping(connectorId, from, to) {
  const holds = await SlotHold.find(
    { connectorId, start: { $lt: to, $gt: addMinutes(from, -SLOT_MINUTES) } },
    { start: 1 }
  ).lean();
  return holds.map((h) => ({ slot_start: h.start, slot_end: addMinutes(h.start, SLOT_MINUTES) }));
}

module.exports = { listProducts, getProduct, getStation, getStationWithPlugs, activeBookingCounts, bookingsOverlapping };
