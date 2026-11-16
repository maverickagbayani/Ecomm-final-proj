// slotholds: one document per 30-minute slot a booking holds on a plug.
// A 70-minute charge starting 14:00 holds three slots: 14:00, 14:30, 15:00.
//
// The unique index on (connectorId, start) is what makes "slot taken → 409" safe:
// if two customers (or one double-click) try to hold the same slot, MongoDB rejects the
// second insert, the whole booking transaction is undone, and the route answers 409.
//
// Why `start` (an exact moment) instead of date + slot number: a charge that runs past
// midnight would otherwise need slot 48, 49… of the first day, which would never clash
// with slot 0, 1… of the next day.
const mongoose = require('mongoose');

const slotHoldSchema = new mongoose.Schema(
  {
    stationId: { type: String, required: true },
    connectorId: { type: String, required: true },
    start: { type: Date, required: true }, // slot start (UTC), always on :00 or :30
    date: { type: String, required: true }, // Manila date of the slot, 'YYYY-MM-DD' (for reading in Atlas)
    bookingId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Booking' },
  },
  { versionKey: false }
);

slotHoldSchema.index({ connectorId: 1, start: 1 }, { unique: true });
slotHoldSchema.index({ start: 1 });

module.exports = mongoose.model('SlotHold', slotHoldSchema, 'slotholds');
