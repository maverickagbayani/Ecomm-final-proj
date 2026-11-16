// Cart (selection summary): what was chosen, the time window and the server's price.
// Fetch: POST /api/bookings/quote → Transform: rows → Render. Loading / empty / error states below.
nav('cart');
const row = (label, value) => `<div class="info-row"><span>${esc(label)}</span><b>${value}</b></div>`;

(async () => {
  const box = $('box'), c = cart.get();
  if (!c) {
    box.innerHTML = '<h2>Nothing selected yet</h2><p class="state state-empty">Pick a station, a plug and an open start time to begin.</p>' +
      '<a class="primary-btn" href="/app/directory.html">Browse stations</a>';
    return;
  }
  let r;
  try {
    r = await quote(c);
  } catch (e) {
    box.innerHTML = '<h2>Could not reach WattSpot</h2><p class="state state-error">Check your connection, then try again.</p>' +
      '<button type="button" class="primary-btn" onclick="location.reload()">Try again</button>';
    return;
  }
  if (r.status === 404) {
    cart.clear();
    box.innerHTML = '<h2>That plug is no longer available</h2><a class="primary-btn" href="/app/directory.html">Browse stations</a>';
    return;
  }
  if (!r.ok) {
    box.innerHTML = `<h2>This selection needs a change</h2><div class="error-msg" role="alert">${esc(r.data.error || 'Please choose again.')}</div>` +
      '<a class="primary-btn" href="/app/directory.html">Browse stations</a>';
    return;
  }

  const q = r.data, b = q.breakdown;
  box.innerHTML = `
    <h2>${esc(q.socket)}</h2>
    ${row('Time slot', `${esc(when(q.slot_start))} – ${esc(clock(q.slot_end))}`)}
    ${row('Car', esc(q.vehicle.model))}
    ${row('Battery', `${esc(q.start_pct)}% → ${esc(q.target_pct)}%`)}
    ${row('Energy (estimated)', `${esc(q.kwh)} kWh`)}
    ${row('Charging time', `about ${esc(q.charging_minutes)} min at ${esc(q.charge_kw)} kW`)}
    ${row('Rate', b.price_per_kwh ? peso(b.price_per_kwh) + '/kWh' : 'Free charging')}
    <div class="estimate" style="margin-top: 14px;">
      ${row('Charging fee', peso(b.charging))}
      ${row('Slot reservation fee', peso(b.reservation_fee))}
      ${row('Refundable overstay deposit', peso(b.deposit))}
      ${row("Watt Credits you'll earn", '+' + esc(q.points_earned) + (q.off_peak ? ' (2× off-peak)' : ''))}
    </div>
    <div class="total-row"><span>Total</span><span>${peso(q.total)}</span></div>
    ${q.available ? '' : '<div class="error-msg" role="alert">Someone just booked this time. Choose another start time.</div>'}
    <div class="btn-row">
      <a class="primary-btn" href="${q.available ? '/checkout/checkout.html' : stationLink(q)}">${q.available ? 'Proceed to checkout' : 'Choose another time'}</a>
      <a class="primary-btn link-btn" href="${stationLink(q)}">Change selection</a>
    </div>
    <button type="button" id="rm" class="primary-btn link-btn">Remove selection</button>`;
  $('rm').addEventListener('click', () => { cart.clear(); window.location.reload(); });
})();
