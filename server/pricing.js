// ALL money and charging-time math lives in this file.
// The browser may show a preview, but the server always recomputes with these functions.
const cfg = require('./config');
const { manila, addMinutes } = require('./time');

// Energy to add, in kWh: battery size × the share being filled.
// e.g. a 60 kWh battery from 20% to 80% needs 60 × 0.60 = 36 kWh.
function energyNeeded(batteryKwh, startPct, targetPct) {
  return Math.round(batteryKwh * (targetPct - startPct)) / 100;
}

// A charge runs at the lower of the charger's output and what the car accepts.
// e.g. a 22 kW plug and a car that takes 11 kW AC → 11 kW.
function chargingSpeed(chargerKw, carMaxKw) {
  return Math.min(chargerKw, carMaxKw);
}

// How long a charge takes (kWh ÷ kW), and how many 30-minute slots it holds.
// e.g. 36 kWh at 50 kW = 44 min → 2 slots.
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

// Everything about one planned charge: energy, speed, time window and bill.
// Used by the booking, the quote and the open-times routes so they always agree.
function planCharge({ batteryKwh, maxKw, startPct, targetPct, chargerKw, pricePerKwhCents, slotStart, paymentMethod }) {
  const kwh = energyNeeded(batteryKwh, startPct, targetPct);
  const speedKw = chargingSpeed(chargerKw, maxKw);
  const window = chargingWindow(kwh, speedKw, slotStart);
  const bill = calculateOrder({ kwh, pricePerKwhCents, slotStart, paymentMethod });
  return { kwh, speedKw, ...window, bill };
}

module.exports = { energyNeeded, chargingSpeed, chargingWindow, calculateOrder, planCharge, isOffPeak };
