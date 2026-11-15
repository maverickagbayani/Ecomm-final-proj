// SQL aggregates for the owner screen.
// This file expects these tables and columns:
//   orders:   product_id, kwh, status, slot_start, slot_end, revenue_cents,
//             reservation_fee_cents, points_earned, points_redeemed
//   products: id, station_id
//   stations: id, name
// If any names are different in your schema, tell me and I'll update the queries.

const { getPool } = require('../db');

async function orderTotals(db = getPool()) {
  const [rows] = await db.query(
    `SELECT COUNT(*) AS orders, COALESCE(SUM(revenue_cents), 0) AS revenue_cents,
            COALESCE(SUM(reservation_fee_cents), 0) AS fee_cents,
            COALESCE(SUM(points_earned), 0) AS points_earned, COALESCE(SUM(points_redeemed), 0) AS points_redeemed
     FROM orders WHERE status = 'confirmed'`
  );
  return rows[0];
}

// The station with the most confirmed orders, breaking ties by kWh delivered.
async function topStation(db = getPool()) {
  
// The station with the most confirmed bookings, breaking ties by kWh delivered.
// Sends the query to MySQL and waits for the result. Groups bookings by station,
// counts them and sums their kWh, sorts by count then kWh (highest first), and keeps the top one.

  const [rows] = await db.query(
    `SELECT s.id, s.name, COUNT(*) AS orders, SUM(o.kwh) AS kwh
     FROM orders o JOIN products p ON p.id = o.product_id JOIN stations s ON s.id = p.station_id
     WHERE o.status = 'confirmed'
     GROUP BY s.id, s.name
     ORDER BY orders DESC, kwh DESC
     LIMIT 1`
  );
  return rows[0] || null;
}

// Confirmed bookings that overlap the time window [fromDb, toDb).
// Used to work out which stations are almost full. 
async function bookedRows(fromDb, toDb, db = getPool()) {
  const [rows] = await db.query(
    `SELECT product_id, slot_start, slot_end FROM orders
     WHERE status = 'confirmed' AND slot_start < ? AND slot_end > ?`,
    [toDb, fromDb]
  );
  return rows;
}

// Shared with server/routes/metrics.js (owner dashboard):
//   orderTotals - total bookings, revenue and Watt Credits
//   topStation  - most-booked station
//   bookedRows  - bookings in a time window (for "slots almost full")

module.exports = { orderTotals, topStation, bookedRows };
