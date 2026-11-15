// ALL money and charging-time math lives in this file.
// The browser may show a preview, but the server always recomputes with these functions.
const cfg = require('./config');
const { manila, addMinutes } = require('./time');

// How long a charge takes, and how many 30-minute slots it holds
function chargingWindow(kwh, powerKw, slotStart) {
  const minutes = Math.ceil((kwh / powerKw) * 60);
  const slotCount = Math.max(1, Math.ceil(minutes / cfg.SLOT_MINUTES));
  return { minutes, slotCount, slotEnd: addMinutes(slotStart, slotCount * cfg.SLOT_MINUTES) };
}

function isOffPeak(date) {
  const { hour } = manila(date);
  return hour >= cfg.OFF_PEAK_START_HOUR || hour < cfg.OFF_PEAK_END_HOUR;
}

// Itemised bill + Watt Credits for one booking
function calculateOrder({ kwh, pricePerKwhCents, slotStart, paymentMethod }) {
  const chargingCents = Math.round(kwh * pricePerKwhCents);
  const reservationFeeCents = cfg.RESERVATION_FEE_CENTS;
  const depositCents = cfg.DEPOSIT_CENTS;
  const totalCents = chargingCents + reservationFeeCents + depositCents;
  const revenueCents = totalCents - depositCents;

  const payingWithCredits = paymentMethod === cfg.CREDITS_PAYMENT;
  const offPeak = isOffPeak(slotStart);
  const pointsRedeemed = payingWithCredits ? Math.ceil(totalCents / cfg.POINT_VALUE_CENTS) : 0;
  const pointsEarned = payingWithCredits
    ? 0 // no credits earned on a booking paid with credits
    : Math.floor((chargingCents / 100) * cfg.POINTS_PER_PESO * (offPeak ? cfg.OFF_PEAK_MULTIPLIER : 1));

  return { chargingCents, reservationFeeCents, depositCents, totalCents, revenueCents, pointsEarned, pointsRedeemed, offPeak };
}

module.exports = { chargingWindow, calculateOrder, isOffPeak };
