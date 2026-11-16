// bookings: one document per saved reservation. All amounts are computed by server/pricing.js.
// Station name and connector details are copied in as a snapshot of what the driver booked.
const mongoose = require('mongoose');
const { PAYMENT_METHODS } = require('../config');

const bookingSchema = new mongoose.Schema(
  {
    ref: { type: String, required: true, unique: true }, // reference no. shown to the driver, e.g. 'WS-7F3K2Q'
    stationId: { type: String, required: true, ref: 'Station' },
    stationName: { type: String, required: true },
    connectorId: { type: String, required: true },
    connectorLabel: { type: String, required: true },
    connectorType: { type: String, required: true },
    connectorKw: { type: Number, required: true },
    customer: {
      name: { type: String, required: true },
      email: { type: String, required: true, lowercase: true },
    },
    paymentMethod: { type: String, required: true, enum: PAYMENT_METHODS },
    vehicle: {
      model: { type: String, required: true },
      batteryKwh: { type: Number, required: true },
      maxKw: { type: Number, required: true },
    },
    startPct: { type: Number, required: true, min: 0, max: 99 },
    targetPct: { type: Number, required: true, min: 1, max: 100 },
    kwh: { type: Number, required: true, min: 0.01 }, // estimated energy = battery × (target − start)
    chargeKw: { type: Number, required: true }, // lower of the plug's and the car's max kW
    slotStart: { type: Date, required: true },
    slotEnd: { type: Date, required: true },
    slotCount: { type: Number, required: true, min: 1 },
    chargingMinutes: { type: Number, required: true },
    pricePerKwhCents: { type: Number, required: true },
    chargingCents: { type: Number, required: true },
    reservationFeeCents: { type: Number, required: true },
    depositCents: { type: Number, required: true },
    totalCents: { type: Number, required: true },
    revenueCents: { type: Number, required: true }, // total minus the refundable deposit
    pointsEarned: { type: Number, required: true },
    pointsRedeemed: { type: Number, required: true },
    offPeak: { type: Boolean, required: true },
    status: { type: String, enum: ['confirmed', 'cancelled'], default: 'confirmed' },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

bookingSchema.index({ createdAt: -1 });
bookingSchema.index({ stationId: 1, status: 1 });

module.exports = mongoose.model('Booking', bookingSchema, 'bookings');
