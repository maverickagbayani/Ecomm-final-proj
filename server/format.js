// Turns database documents into the JSON the pages expect (field names kept from the original API).

const { CONNECTORS, IDLE_GRACE_MINUTES } = require('./config');
const { toIso, addMinutes, manila } = require('./time');
const { is24h } = require('./availability');

// centavos → pesos
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

// One bookable plug (from repositories/products.js). `stock` = 1 if the plug is free right now, else 0.
function formatProduct(p, activeCount, now) {
  return {
    id: p.id,
    station_id: p.station_id,
    name: `${p.station_name} · ${p.label}`,
    station_name: p.station_name,
    address: p.address,
    area: p.area,
    lat: p.lat,
    lng: p.lng,
    connector: CONNECTORS[p.connector] || p.connector,
    connector_code: p.connector,
    power_kw: p.power_kw,
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

// One booking document (from repositories/orders.js)
function formatOrder(o) {
  return {
    id: String(o._id),
    ref: o.ref,
    connector_id: o.connectorId,
    product_id: o.connectorId,
    station_id: o.stationId,
    customer_name: o.customer.name,
    customer_email: o.customer.email,
    payment_method: o.paymentMethod,
    socket: `${o.stationName} · ${o.connectorLabel}`,
    connector: CONNECTORS[o.connectorType] || o.connectorType,
    power_kw: o.connectorKw,
    vehicle: o.vehicle ? { model: o.vehicle.model, battery_kwh: o.vehicle.batteryKwh, max_kw: o.vehicle.maxKw } : null,
    start_pct: o.startPct,
    target_pct: o.targetPct,
    kwh: o.kwh,
    charge_kw: o.chargeKw,
    slot_start: toIso(o.slotStart),
    slot_end: toIso(o.slotEnd),
    slot_count: o.slotCount,
    socket_frees_at: addMinutes(new Date(o.slotEnd), IDLE_GRACE_MINUTES).toISOString(),
    charging_minutes: o.chargingMinutes,
    breakdown: {
      price_per_kwh: pesos(o.pricePerKwhCents),
      charging: pesos(o.chargingCents),
      reservation_fee: pesos(o.reservationFeeCents),
      deposit: pesos(o.depositCents),
    },
    total: pesos(o.totalCents),
    revenue: pesos(o.revenueCents),
    points_earned: o.pointsEarned,
    points_redeemed: o.pointsRedeemed,
    points_balance: o.pointsBalance,
    off_peak: o.offPeak,
    status: o.status,
    createdAt: toIso(o.createdAt),
  };
}

function formatReport(r) {
  return {
    id: String(r._id),
    station_id: r.stationId,
    station: r.stationName,
    issue_type: r.issueType,
    description: r.description,
    reporter_name: r.reporterName,
    reporter_email: r.reporterEmail,
    status: r.status,
    createdAt: toIso(r.createdAt),
    resolvedAt: toIso(r.resolvedAt),
  };
}

module.exports = { formatProduct, formatStationForMap, formatOrder, formatReport, pesos, hoursLabel };
