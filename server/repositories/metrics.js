// Aggregates for the owner screen, computed from saved bookings and slot holds.
const { Booking, SlotHold } = require('../models');
const { SLOT_MINUTES } = require('../config');
const { addMinutes } = require('../time');

// Totals over all confirmed bookings
async function orderTotals() {
  const [row] = await Booking.aggregate([
    { $match: { status: 'confirmed' } },
    {
      $group: {
        _id: null,
        orders: { $sum: 1 },
        revenue_cents: { $sum: '$revenueCents' },
        fee_cents: { $sum: '$reservationFeeCents' },
        points_earned: { $sum: '$pointsEarned' },
        points_redeemed: { $sum: '$pointsRedeemed' },
      },
    },
  ]);
  return row || { orders: 0, revenue_cents: 0, fee_cents: 0, points_earned: 0, points_redeemed: 0 };
}

// The station with the most confirmed bookings, breaking ties by kWh booked.
async function topStation() {
  const [row] = await Booking.aggregate([
    { $match: { status: 'confirmed' } },
    { $group: { _id: '$stationId', name: { $first: '$stationName' }, orders: { $sum: 1 }, kwh: { $sum: '$kwh' } } },
    { $sort: { orders: -1, kwh: -1 } },
    { $limit: 1 },
  ]);
  return row ? { id: row._id, name: row.name, orders: row.orders, kwh: row.kwh } : null;
}

// Every held slot in the window [from, to), as { product_id, slot_start, slot_end }.
// Used to work out which plugs are almost full.
async function bookedRows(from, to) {
  const holds = await SlotHold.find({ start: { $gte: from, $lt: to } }, { connectorId: 1, start: 1 }).lean();
  return holds.map((h) => ({ product_id: h.connectorId, slot_start: h.start, slot_end: addMinutes(h.start, SLOT_MINUTES) }));
}

module.exports = { orderTotals, topStation, bookedRows };
