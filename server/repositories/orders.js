// Bookings, slot holds and customers. Only this file writes to those collections.
const mongoose = require('mongoose');
const crypto = require('crypto');
const { Booking, SlotHold, Customer } = require('../models');
const { SLOT_MINUTES } = require('../config');
const { addMinutes, manila } = require('../time');

// A short reference number for the driver, e.g. 'WS-7F3K2Q' (no 0/O or 1/I to avoid mix-ups)
const REF_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function newRef() {
  const bytes = crypto.randomBytes(6);
  return 'WS-' + [...bytes].map((b) => REF_CHARS[b % REF_CHARS.length]).join('');
}

// The customer with this email, or null. Read inside the booking transaction.
async function findCustomer(email, session = null) {
  return Customer.findOne({ email }).session(session).lean();
}

// Saves the booking and one slot hold per 30-minute slot, inside the caller's transaction.
// If any slot is already held, MongoDB throws a duplicate-key error (code 11000) on the
// slotholds unique index, and the whole transaction is undone.
async function insertBookingWithHolds(session, booking) {
  const [doc] = await Booking.create([{ ...booking, ref: newRef() }], { session });
  const holds = [];
  for (let k = 0; k < booking.slotCount; k++) {
    const start = addMinutes(booking.slotStart, k * SLOT_MINUTES);
    holds.push({ stationId: booking.stationId, connectorId: booking.connectorId, start, date: manila(start).date, bookingId: doc._id });
  }
  await SlotHold.insertMany(holds, { session, ordered: true });
  return doc;
}

// Adds earned credits and removes redeemed ones, creating the customer on their first booking.
// Spending credits only succeeds if the balance is high enough (checked by MongoDB itself,
// so two bookings at the same moment can't both spend the same credits).
// Returns false if they don't have enough credits.
async function applyPoints(session, { email, name, earned, redeemed }) {
  if (redeemed > 0) {
    const res = await Customer.updateOne(
      { email, points: { $gte: redeemed } },
      { $inc: { points: earned - redeemed }, $set: { name } },
      { session }
    );
    return res.matchedCount === 1;
  }
  await Customer.updateOne(
    { email },
    { $inc: { points: earned }, $set: { name }, $setOnInsert: { createdAt: new Date() } },
    { session, upsert: true }
  );
  return true;
}

// One booking by its id, plus the customer's current Watt Credits balance, or null.
async function getOrder(id, session = null) {
  if (!mongoose.isValidObjectId(id)) return null;
  const booking = await Booking.findById(id).session(session).lean();
  if (!booking) return null;
  const customer = await Customer.findOne({ email: booking.customer.email }, { points: 1 }).session(session).lean();
  return { ...booking, pointsBalance: customer ? customer.points : 0 };
}

// Many bookings, newest first, one page at a time. Used by the owner dashboard.
async function listOrders({ limit, offset }) {
  const bookings = await Booking.find().sort({ createdAt: -1 }).skip(offset).limit(limit).lean();
  const emails = [...new Set(bookings.map((b) => b.customer.email))];
  const customers = await Customer.find({ email: { $in: emails } }, { email: 1, points: 1 }).lean();
  const points = new Map(customers.map((c) => [c.email, c.points]));
  return bookings.map((b) => ({ ...b, pointsBalance: points.get(b.customer.email) || 0 }));
}

// This customer's confirmed booking on this plug starting at this exact time, or null.
// Used when a booking hits a taken slot: if the slot is held by the SAME customer
// (a second tab, or a retry after a lost response), we point them to that booking.
async function findSameBooking({ email, connectorId, slotStart }) {
  return Booking.findOne({ 'customer.email': email, connectorId, slotStart, status: 'confirmed' }, { _id: 1, ref: 1 }).lean();
}

// The Watt Credits balance for an email, or null if no customer has it.
async function customerPoints(email) {
  return Customer.findOne({ email }, { _id: 0, email: 1, name: 1, points: 1 }).lean();
}

module.exports = { findCustomer, insertBookingWithHolds, applyPoints, getOrder, listOrders, findSameBooking, customerPoints };
