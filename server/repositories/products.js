// SQL for stations and products (socket banks). Only this file queries those tables.
const { getPool } = require('../db');

// Shared start of every "read products" query: each product (charger) plus its station's details
const PRODUCT_SELECT = `
  SELECT p.id, p.station_id, p.connector, p.power_kw, p.price_per_kwh_cents, p.sockets,
         s.name AS station_name, s.address, s.lat, s.lng, s.open_hour, s.close_hour, s.description
  FROM products p JOIN stations s ON s.id = p.station_id`;


// All products, narrowed by the filters the page:
//   q         - search text, matched against station name or address
//   connector - plug type, e.g. 'CCS2'
//   pricing   - 'FREE' or 'PAID'
// Only the filters that were given are added to the WHERE part.
// Used by: GET /api/products and GET /api/stations (map)

async function listProducts({ q, connector, pricing }, db = getPool()) {
  const where = []; // conditions to add, e.g. 'p.connector = ?'
  const params = []; // the values for each ?, in the same order
  if (q) {
     // % means "anything before or after", so like 'Katip' matches 'Katipunan Ave' so this is to speed up
    where.push('(s.name LIKE ? OR s.address LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }
  if (connector) {
    where.push('p.connector = ?');
    params.push(connector);
  }
  if (pricing === 'FREE') where.push('p.price_per_kwh_cents = 0');
  if (pricing === 'PAID') where.push('p.price_per_kwh_cents > 0');
  // this joins the conditions with AND, or leaves WHERE out if there are no filters.
  // Sorted by station name, then fastest charger first.
  const sql = `${PRODUCT_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY s.name, p.power_kw DESC`;
  const [rows] = await db.query(sql, params);
  return rows;
}

// One product by its id, or null if it doesn't exist (the route then answers 404).
// Used by: GET /api/products/:id, availability, and saving a booking

async function getProduct(id, db = getPool()) {
  const [rows] = await db.query(`${PRODUCT_SELECT} WHERE p.id = ?`, [id]);
  return rows[0] || null;
}

// Locks the product row until the transaction ends, so two bookings for the
// same sockets are checked one after the other, never at the same time.
async function lockProduct(conn, id) {
  await conn.query('SELECT id FROM products WHERE id = ? FOR UPDATE', [id]);
}

async function getStation(id, db = getPool()) {
  const [rows] = await db.query('SELECT * FROM stations WHERE id = ?', [id]);
  return rows[0] || null;
}

// How many bookings are in progress right now, per product
// (started at or before now, and not yet ended).
// Returns a Map like { 1 => 2, 7 => 1 }: product 1 has 2 sockets in use, product 7 has 1.
// Used to show "x of y free now" on station lists.
async function activeBookingCounts(nowDb, db = getPool()) {
  const [rows] = await db.query(
    `SELECT product_id, COUNT(*) AS n FROM orders
     WHERE status = 'confirmed' AND slot_start <= ? AND slot_end > ?
     GROUP BY product_id`,
    [nowDb, nowDb]
  );
  return new Map(rows.map((r) => [Number(r.product_id), Number(r.n)]));
}

// Saved bookings of one product that overlap the time window [fromDb, toDb).
// Two windows overlap when one starts before the other ends, and ends after the other starts.
// Used by: open start times (availability) and the "is a socket free?" check when booking

async function bookingsOverlapping(productId, fromDb, toDb, db = getPool()) {
  const [rows] = await db.query(
    `SELECT slot_start, slot_end FROM orders
     WHERE product_id = ? AND status = 'confirmed' AND slot_start < ? AND slot_end > ?`,
    [productId, toDb, fromDb]
  );
  return rows;
}
// Makes these functions available to other files.
// Used by server/routes/products.js, orders.js, reports.js and metrics.js.

module.exports = { listProducts, getProduct, lockProduct, getStation, activeBookingCounts, bookingsOverlapping };
