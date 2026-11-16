// Input checks. The server never trusts the browser: every field is checked again here.
// Each function returns { errors: { field: message }, values } with cleaned-up values.
const cfg = require('./config');
const { PAYMENT_METHODS, ISSUE_TYPES } = cfg;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function toPositiveInt(v) {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return Number.isInteger(n) && n > 0 ? n : null;
}

// A plug or station id, e.g. 'UPTC-DC1' or 'up-town-center'. Returns the id, or null if it's not one.
function toId(v) {
  const s = typeof v === 'string' ? v.trim() : '';
  return /^[A-Za-z0-9-]{1,40}$/.test(s) ? s : null;
}

// '60' or 60 → 60; '', null, 'abc' → NaN (so every check below fails cleanly)
function toNumber(v) {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.trim() !== '') return Number(v);
  return NaN;
}

// The car and the charge: battery size, max charging speed, battery % now and target %.
// `src` is a flat object: { model, battery_kwh, max_kw, start_pct, target_pct }.
// Used by POST /api/bookings, POST /api/bookings/quote and GET /api/stations/:id/availability.
function validateCharge(src, errors) {
  const s = src && typeof src === 'object' ? src : {};
  const model = typeof s.model === 'string' && s.model.trim() ? s.model.trim().slice(0, 60) : 'My EV';

  const batteryKwh = toNumber(s.battery_kwh);
  if (!(batteryKwh >= cfg.MIN_BATTERY_KWH && batteryKwh <= cfg.MAX_BATTERY_KWH)) {
    errors.battery_kwh = `Battery capacity must be ${cfg.MIN_BATTERY_KWH} to ${cfg.MAX_BATTERY_KWH} kWh.`;
  }
  const maxKw = toNumber(s.max_kw);
  if (!(maxKw >= cfg.MIN_CAR_KW && maxKw <= cfg.MAX_CAR_KW)) {
    errors.max_kw = `Max charging speed must be ${cfg.MIN_CAR_KW} to ${cfg.MAX_CAR_KW} kW.`;
  }
  const startPct = toNumber(s.start_pct);
  const targetPct = toNumber(s.target_pct);
  if (!(Number.isInteger(startPct) && startPct >= 0 && startPct <= 99)) errors.start_pct = 'Battery now must be a whole number from 0 to 99%.';
  if (!(Number.isInteger(targetPct) && targetPct >= 1 && targetPct <= 100)) errors.target_pct = 'Charge-to must be a whole number from 1 to 100%.';
  else if (!errors.start_pct && targetPct <= startPct) errors.target_pct = 'Charge-to % must be higher than your battery now.';

  return { model, batteryKwh: Math.round(batteryKwh * 10) / 10, maxKw: Math.round(maxKw * 10) / 10, startPct, targetPct };
}

// The booking request without the customer: plug, time, car and charge.
// Payment method is optional for a quote (defaults to the first wallet).
function validateSelection(body, { requirePayment }) {
  const b = body && typeof body === 'object' ? body : {};
  const errors = {};

  // The plug, e.g. 'UPTC-DC1'. `connector_id` is the plan's name; `product_id` is the older one.
  const productId = toId(b.connector_id !== undefined ? b.connector_id : b.product_id);
  if (!productId) errors.connector_id = 'Choose a station socket.';

  const slotStart = typeof b.slot_start === 'string' ? new Date(b.slot_start) : null;
  if (!slotStart || Number.isNaN(slotStart.getTime())) errors.slot_start = 'Pick a valid arrival date and time';

  let paymentMethod = b.payment_method;
  if (paymentMethod === undefined && !requirePayment) paymentMethod = PAYMENT_METHODS[0];
  if (!PAYMENT_METHODS.includes(paymentMethod)) errors.payment_method = 'Invalid payment method';

  const charge = validateCharge({ ...(b.vehicle || {}), start_pct: b.start_pct, target_pct: b.target_pct }, errors);
  return { errors, values: { productId, slotStart, paymentMethod, ...charge } };
}

function validateOrder(body) {
  const b = body && typeof body === 'object' ? body : {};
  const { errors, values } = validateSelection(b, { requirePayment: true });

  const name = typeof b.customer_name === 'string' ? b.customer_name.trim() : '';
  if (!name) errors.customer_name = 'Enter your name.';
  else if (name.length < 2 || name.length > 80) errors.customer_name = 'Name must be 2 to 80 characters.';

  const email = typeof b.customer_email === 'string' ? b.customer_email.trim().toLowerCase() : '';
  if (!email) errors.customer_email = 'Enter your email.';
  else if (!EMAIL.test(email) || email.length > 120) errors.customer_email = 'Enter a valid email address.';

  return { errors, values: { ...values, customerName: name, customerEmail: email } };
}

function validateReport(body) {
  const b = body && typeof body === 'object' ? body : {};
  const errors = {};
  const stationId = toId(b.station_id);
  if (!stationId) errors.station_id = 'Choose a station.';
  if (!ISSUE_TYPES.includes(b.issue_type)) errors.issue_type = b.issue_type ? 'Invalid issue type' : 'Choose an issue type.';
  const description = typeof b.description === 'string' ? b.description.trim() : '';
  if (description.length < 10 || description.length > 500) errors.description = 'Description must be 10 to 500 characters';
  const reporterName = typeof b.reporter_name === 'string' ? b.reporter_name.trim().slice(0, 80) : '';
  const reporterEmail = typeof b.reporter_email === 'string' ? b.reporter_email.trim() : '';
  if (reporterEmail && !EMAIL.test(reporterEmail)) errors.reporter_email = 'Enter a valid email address';
  return { errors, values: { stationId, issueType: b.issue_type, description, reporterName, reporterEmail } };
}

const hasErrors = (errors) => Object.keys(errors).length > 0;

// 400 body: the first message as `error` (what the pages already show) plus every field's message
const errorBody = (errors) => ({ error: Object.values(errors)[0], fields: errors });

module.exports = { validateCharge, validateSelection, validateOrder, validateReport, hasErrors, errorBody, toPositiveInt, toId, EMAIL };
