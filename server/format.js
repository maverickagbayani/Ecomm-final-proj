// Turns database rows into the JSON the pages expect (field names kept from the original server.js).
// this stores things 

const { CONNECTORS, IDLE_GRACE_MINUTES } = require('./config');
const { toIso, fromDb, addMinutes, manila } = require('./time');
const { is24h } = require('./availability');

//conversion
const pesos = (cents) => Math.round(Number(cents)) / 100;

function clock12(hour) {
  if (hour === 0 || hour === 24) return '12:00 MN';
  if (hour === 12) return '12:00 NN';
  return `${((hour + 11) % 12) + 1}:00 ${hour < 12 ? 'AM' : 'PM'}`;
}

function hoursLabel(st) {
  return is24h(st) ? 'Open 24/7' : `Daily ${clock12(st.open_hour)} to ${clock12(st.close_hour)}`;
}

function isOpenNow(st, now) {
  if (is24h(st)) return true;
  const m = manila(now).minuteOfDay;
  return m >= st.open_hour * 60 && m < st.close_hour * 60;
}

// One bookable product. `stock` = sockets free right now (computed from saved bookings).
function formatProduct(p, activeCount, now) {
  const label = CONNECTORS[p.connector] || p.connector;
  return {
    id: p.id,
    station_id: p.station_id,
    name: `${p.station_name} · ${label}`,
    station_name: p.station_name,
    address: p.address,
    lat: Number(p.lat),
    lng: Number(p.lng),
    connector: label,
    connector_code: p.connector,
    power_kw: Number(p.power_kw),
    hours: hoursLabel(p),
    open_now: isOpenNow(p, now),
    description: p.description,
    price_per_kwh: pesos(p.price_per_kwh_cents),
    sockets: p.sockets,
    stock: Math.max(0, p.sockets - (activeCount || 0)),
  };
}

// Station summary in the shape Zaira's map (frontend-map/script.js) reads
function formatStationForMap(products) {
  const first = products[0];
  const paid = products.filter((p) => p.price_per_kwh > 0);
  return {
    id: first.station_id,
    name: first.station_name,
    address: first.address,
    location: { type: 'Point', coordinates: [first.lng, first.lat] },
    freeSockets: products.reduce((n, p) => n + p.stock, 0),
    totalSockets: products.reduce((n, p) => n + p.sockets, 0),
    connectors: [...new Set(products.map((p) => p.connector_code))],
    pricing: paid.length ? 'PAID' : 'FREE',
    pricePerKwh: paid.length ? Math.min(...paid.map((p) => p.price_per_kwh)) : 0,
    hours: first.hours,
    products: products.map((p) => p.id),
  };
}

function formatOrder(o) {
  const label = CONNECTORS[o.connector] || o.connector;
  return {
    id: o.id,
    product_id: o.product_id,
    station_id: o.station_id,
    customer_name: o.customer_name,
    customer_email: o.customer_email,
    payment_method: o.payment_method,
    socket: `${o.station_name} · ${label}`,
    kwh: Number(o.kwh),
    slot_start: toIso(o.slot_start),
    slot_end: toIso(o.slot_end),
    socket_frees_at: addMinutes(fromDb(o.slot_end), IDLE_GRACE_MINUTES).toISOString(),
    charging_minutes: o.charging_minutes,
    breakdown: {
      price_per_kwh: pesos(o.price_per_kwh_cents),
      charging: pesos(o.charging_cents),
      reservation_fee: pesos(o.reservation_fee_cents),
      deposit: pesos(o.deposit_cents),
    },
    total: pesos(o.total_cents),
    revenue: pesos(o.revenue_cents),
    points_earned: o.points_earned,
    points_redeemed: o.points_redeemed,
    points_balance: o.points_balance,
    status: o.status,
    createdAt: toIso(o.created_at),
  };
}

function formatReport(r) {
  return {
    id: r.id,
    station_id: r.station_id,
    station: r.station_name,
    issue_type: r.issue_type,
    description: r.description,
    reporter_name: r.reporter_name,
    reporter_email: r.reporter_email,
    status: r.status,
    createdAt: toIso(r.created_at),
    resolvedAt: toIso(r.resolved_at),
  };
}

module.exports = { formatProduct, formatStationForMap, formatOrder, formatReport, pesos, hoursLabel };
