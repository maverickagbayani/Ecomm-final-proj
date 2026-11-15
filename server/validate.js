// Input checks. The server never trusts the browser: every field is checked again here.
// Each function returns { errors: { field: message }, values } with cleaned-up values.
const { PAYMENT_METHODS, ISSUE_TYPES, MAX_KWH } = require('./config');

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function toPositiveInt(v) {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return Number.isInteger(n) && n > 0 ? n : null;
}

function validateOrder(body) {
  const b = body && typeof body === 'object' ? body : {};
  const errors = {};

  const name = typeof b.customer_name === 'string' ? b.customer_name.trim() : '';
  if (!name) errors.customer_name = 'Enter your name.';
  else if (name.length < 2 || name.length > 80) errors.customer_name = 'Name must be 2 to 80 characters.';

  const email = typeof b.customer_email === 'string' ? b.customer_email.trim().toLowerCase() : '';
  if (!email) errors.customer_email = 'Enter your email.';
  else if (!EMAIL.test(email) || email.length > 120) errors.customer_email = 'Enter a valid email address.';

  const productId = toPositiveInt(b.product_id);
  if (!productId) errors.product_id = 'Choose a station socket.';

  const kwh = typeof b.kwh === 'string' && b.kwh.trim() !== '' ? Number(b.kwh) : b.kwh;
  if (kwh === undefined || kwh === null || kwh === '') errors.kwh = 'Enter how many kWh you want to charge.';
  else if (typeof kwh !== 'number' || !Number.isFinite(kwh) || kwh <= 0) errors.kwh = 'kWh must be a positive number greater than 0';
  else if (kwh > MAX_KWH) errors.kwh = `kWh cannot be more than ${MAX_KWH}.`;

  if (!PAYMENT_METHODS.includes(b.payment_method)) errors.payment_method = 'Invalid payment method';

  const slotStart = typeof b.slot_start === 'string' ? new Date(b.slot_start) : null;
  if (!slotStart || Number.isNaN(slotStart.getTime())) errors.slot_start = 'Pick a valid arrival date and time';

  return {
    errors,
    values: {
      customerName: name,
      customerEmail: email,
      productId,
      kwh: typeof kwh === 'number' ? Math.round(kwh * 100) / 100 : kwh,
      paymentMethod: b.payment_method,
      slotStart,
    },
  };
}

function validateReport(body) {
  const b = body && typeof body === 'object' ? body : {};
  const errors = {};
  const stationId = toPositiveInt(b.station_id);
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

module.exports = { validateOrder, validateReport, hasErrors, errorBody, toPositiveInt };
