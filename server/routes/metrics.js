// Owner screen numbers: GET /api/metrics (all computed from saved bookings).
const express = require('express');
const metricsRepo = require('../repositories/metrics');   // totals and most-booked station
const productsRepo = require('../repositories/products'); // list of chargers (products)
const { busyPerSlot, openingHours, is24h } = require('../availability');
const { pesos } = require('../format');                    // centavos → pesos
const { toDb, manila, manilaMidnight, addMinutes } = require('../time');
const { CONNECTORS, BOOKING_DAYS_AHEAD, SLOT_MINUTES, ALMOST_FULL_RATIO } = require('../config');

// A small group of routes that server/routes/index.js plugs in under /api
const router = express.Router();

// "Slots almost full": for each charger and each of the next 7 days,
// checks how many of its 30-minute socket-slots are booked.
// If 80% or more are booked (ALMOST_FULL_RATIO in config.js), it's added to the list.
async function almostFull(now) {
  // The booking window: from today's midnight (Manila time) to 7 days later
  const firstDay = manila(now).date;
  const from = manilaMidnight(firstDay);
  const to = addMinutes(from, BOOKING_DAYS_AHEAD * 24 * 60);

  // Load all chargers and all bookings in that window at the same time (in parallel)
  const [products, orders] = await Promise.all([
    productsRepo.listProducts({}),
    metricsRepo.bookedRows(toDb(from), toDb(to)),
  ]);

  const result = [];
  for (const p of products) {
    // Only this charger's bookings
    const mine = orders.filter((o) => Number(o.product_id) === Number(p.id));

    for (let d = 0; d < BOOKING_DAYS_AHEAD; d++) {
      const dayStart = addMinutes(from, d * 24 * 60);
      // When the station opens that day (midnight if it's open 24/7)
      const open = is24h(p) ? dayStart : openingHours(p, dayStart).open;
      // How many 30-minute slots it's open that day, e.g. 10 AM–10 PM = 12 hours = 24 slots
      const slotsOpen = ((is24h(p) ? 24 : p.close_hour - p.open_hour) * 60) / SLOT_MINUTES;
      // Total socket-slots = slots × sockets, e.g. 24 slots × 2 sockets = 48
      const total = slotsOpen * p.sockets;
      // Booked socket-slots: for each slot, count bookings in it (never more than the sockets), then add them up
      const booked = busyPerSlot(mine, open, slotsOpen).reduce((a, b) => a + Math.min(b, p.sockets), 0);

      if (total && booked / total >= ALMOST_FULL_RATIO) {
        result.push({
          id: p.id,
          name: `${p.station_name} · ${CONNECTORS[p.connector] || p.connector}`, // e.g. "Trinoma · CCS2 DC"
          date: manila(dayStart).date,
          available_slots: total - booked,
          total_slots: total,
        });
      }
    }
  }
  return result;
}

// GET /api/metrics: the five owner numbers, plus a few extras.
router.get('/metrics', async (req, res) => {
  const now = new Date();
  // Three independent calculations, run in parallel
  const [totals, top, lowStock] = await Promise.all([
    metricsRepo.orderTotals(),
    metricsRepo.topStation(),
    almostFull(now),
  ]);

  // MySQL returns sums as text, so convert to numbers
  const orders = Number(totals.orders);
  const revenueCents = Number(totals.revenue_cents);

  res.status(200).json({
    total_orders: orders,                                        // 1. number of bookings
    total_revenue: pesos(revenueCents),                          // 2. revenue (excludes refundable deposits)
    average_order_value: orders ? pesos(revenueCents / orders) : 0, // 3. average booking value (0 if no bookings yet)
    top_selling_station: top                                     // 4. most-booked station, or null
      ? { id: top.id, name: top.name, orders: Number(top.orders), kwh: Number(Number(top.kwh).toFixed(2)) }
      : null,
    low_stock: lowStock,                                         // 5. slots almost full
    // Extra context for the owner (not one of the five required numbers)
    reservation_fee_revenue: pesos(totals.fee_cents),
    watt_credits_issued: Number(totals.points_earned),
    watt_credits_redeemed: Number(totals.points_redeemed),
  });
});

// Makes these routes available to server/routes/index.js
module.exports = router;