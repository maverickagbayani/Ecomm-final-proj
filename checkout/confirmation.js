// Confirmation (Save): the booking read back from the database by its id (GET /api/bookings/:id).
nav('');
const row = (label, value) => `<div class="info-row"><span>${esc(label)}</span><b>${value}</b></div>`;
const box = $('details');
const bookingId = new URLSearchParams(window.location.search).get('id');
const backLinks = '<div class="btn-row"><a class="primary-btn" href="/app/directory.html">Browse stations</a><a class="primary-btn link-btn" href="/shop/cart.html">Your cart</a></div>';

async function load() {
  if (!bookingId) {
    box.innerHTML = '<h2>No booking to show</h2><p class="state state-empty">Open this page from checkout after you pay.</p>' + backLinks;
    return;
  }
  let res, o;
  try {
    res = await fetch('/api/bookings/' + encodeURIComponent(bookingId));
    o = await res.json();
  } catch (e) {
    box.innerHTML = '<h2>Could not load your booking</h2><p class="state state-error">Check your connection, then try again.</p>' +
      '<button type="button" class="primary-btn" onclick="location.reload()">Try again</button>';
    return;
  }
  if (!res.ok) {
    box.innerHTML = '<h2>Booking not found</h2><p class="state state-error">Check the link, or book again.</p>' + backLinks;
    return;
  }

  const b = o.breakdown;
  document.title = `Booking ${o.ref} · WattSpot`;
  box.innerHTML = `
    <div style="text-align: center;">
      <span class="big-check" aria-hidden="true">✓</span>
      <h1 style="margin: 12px 0 4px;">Reservation confirmed</h1>
      <p class="muted" style="margin: 0;">Reference</p>
      <p class="ref" style="margin: 0 0 16px;">${esc(o.ref)}</p>
    </div>
    ${row('Station', esc(o.socket))}
    ${row('Arrive', esc(when(o.slot_start)))}
    ${row('Plug is yours until', esc(clock(o.slot_end)))}
    ${o.vehicle ? row('Car', `${esc(o.vehicle.model)} · ${esc(o.vehicle.battery_kwh)} kWh`) : ''}
    ${o.start_pct != null ? row('Battery', `${esc(o.start_pct)}% → ${esc(o.target_pct)}%`) : ''}
    ${row('Energy (estimated)', `${esc(o.kwh)} kWh`)}
    ${row('Charging time', `about ${esc(o.charging_minutes)} min at ${esc(o.charge_kw)} kW`)}
    ${row('Name', esc(o.customer_name))}
    ${row('Email', esc(o.customer_email))}
    <div class="estimate" style="margin-top: 14px;">
      ${row('Charging fee', peso(b.charging))}
      ${row('Slot reservation fee', peso(b.reservation_fee))}
      ${row('Refundable overstay deposit', peso(b.deposit))}
      ${row('Paid with', esc(o.payment_method))}
      ${o.points_redeemed ? row('Watt Credits used', esc(o.points_redeemed)) : ''}
    </div>
    <div class="total-row"><span>Total paid</span><span>${peso(o.total)}</span></div>
    <div class="ok-msg">+${esc(o.points_earned)} Watt Credits${o.off_peak ? ' (2× off-peak)' : ''}. Your balance: <b>${esc(o.points_balance)}</b>.</div>
    <p class="note">Your ₱${esc(b.deposit)} deposit is refunded if you leave the plug on time.</p>
    <div class="btn-row">
      <button type="button" class="primary-btn" onclick="window.print()">Save receipt</button>
      <a class="primary-btn link-btn" href="/app/directory.html">Book another slot</a>
    </div>`;
}

load();
