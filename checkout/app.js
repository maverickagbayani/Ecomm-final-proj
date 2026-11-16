// Shared helpers for the cart, checkout and confirmation pages.
// (checkout/app.js is an identical copy, so each folder's pages can load "app.js".)
// Prices are never computed here: they come from the server's quote (POST /api/bookings/quote).
const $ = id => document.getElementById(id);
const peso = n => '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const when = iso => new Date(iso).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' });
const clock = iso => new Date(iso).toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' });

// The selection saved by the station page:
// { product_id, slot_start, vehicle: { model, battery_kwh, max_kw }, start_pct, target_pct }
const cart = {
  get() {
    try {
      const c = JSON.parse(localStorage.getItem('wattspot_cart'));
      return c && c.product_id && c.vehicle ? c : null; // ignore selections saved in an older format
    } catch (e) { return null; }
  },
  set(c) { try { localStorage.setItem('wattspot_cart', JSON.stringify(c)); } catch (e) {} },
  clear() { try { localStorage.removeItem('wattspot_cart'); } catch (e) {} }
};

// Asks the server to price the selection. Resolves to { ok, status, data }.
async function quote(c, paymentMethod) {
  const res = await fetch('/api/bookings/quote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      connector_id: c.product_id, slot_start: c.slot_start, vehicle: c.vehicle,
      start_pct: c.start_pct, target_pct: c.target_pct,
      ...(paymentMethod ? { payment_method: paymentMethod } : {})
    })
  });
  let data = {};
  try { data = await res.json(); } catch (e) {}
  return { ok: res.ok, status: res.status, data };
}

// Link back to the station page with the same plug selected
const stationLink = q => `/app/station.html?id=${encodeURIComponent(q.station_id)}&plug=${encodeURIComponent(q.product_id)}`;

// Draws the same top bar as the /app pages into <header id="nav" class="topbar">
function nav(on) {
  $('nav').innerHTML = '<div class="logo"><a href="/app/index.html">WattSpot</a></div><nav class="topbar-links">' +
    [['map', 'Map', '/app/map.html'], ['stations', 'Stations', '/app/directory.html'], ['cart', 'Cart', '/shop/cart.html']]
      .map(([k, l, h]) => `<a href="${h}"${k === on ? ' aria-current="page"' : ''}>${l}</a>`).join('') + '</nav>';
}

// Shows a loading / empty / error message inside an element
const showState = (el, kind, text) => { el.innerHTML = `<p class="state state-${kind}">${esc(text)}</p>`; };
