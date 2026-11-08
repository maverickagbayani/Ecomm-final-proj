nav('stations');
const id = new URLSearchParams(location.search).get('id');
const pad = n => String(n).padStart(2, '0');
const local = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
let p = null;

function upd() {
  const kwh = parseFloat($('kwh').value) || 0;
  $('est').textContent = kwh > 0
    ? `About ${Math.ceil(kwh / p.power_kw * 60)} min at ${p.power_kw} kW. Charging ${peso(billFor(p, kwh).charging)} + ${peso(FEES.reservation)} reservation + ${peso(FEES.deposit)} refundable deposit.`
    : '';
  $('tot').textContent = peso(billFor(p, kwh).total);
}

async function init() {
  try {
    const r = await fetch('/api/products/' + encodeURIComponent(id));
    if (!r.ok) throw new Error('missing');
    p = await r.json();
  } catch (e) {
    $('page').innerHTML = '<div><h3>Station not found</h3><a href="stations.html">Back to stations</a></div>';
    return;
  }
  const saved = cart.get();
  const same = saved && saved.product_id == p.id && new Date(saved.slot_start) > new Date();
  const d = new Date(Date.now() + 3600000);
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0);
  const full = p.stock < 1;
  document.title = p.name + ' · WattSpot';
  $('page').innerHTML = `
    <div><h2>${esc(p.name)}</h2><span>${full ? 'Full' : p.stock + ' free'}</span></div>
    <div>
      <div>
        <h3>Station details</h3>
        <div><span>Address</span><b>${esc(p.address)}</b></div>
        <div><span>Hours</span><b>${esc(p.hours)}</b></div>
        <div><span>Connector</span><b>${esc(p.connector)}</b></div>
        <div><span>Max power</span><b>${p.power_kw} kW</b></div>
        <div><span>Rate</span><b>${p.price_per_kwh ? peso(p.price_per_kwh) + '/kWh' : 'Free charging'}</b></div>
        <div><span>Free sockets</span><b>${p.stock}</b></div>
        <div>${esc(p.description)}</div>
      </div>
      <div>
        <h3>Select your slot</h3>
        <label for="kwh">Energy to charge (kWh)</label>
        <input id="kwh" type="number" min="1" max="200" step="0.1" value="${same ? saved.kwh : 20}">
        <label for="slot">Arrival date and time</label>
        <input id="slot" type="datetime-local" step="1800" min="${local(new Date())}" value="${local(same ? new Date(saved.slot_start) : d)}">
        <div id="est"></div>
        <div><span>Estimated total today</span><span id="tot">${peso(0)}</span></div>
        <div id="err" role="alert" hidden></div>
        <button type="button" id="sel" ${full ? 'disabled' : ''}>${full ? 'No free sockets' : 'Select this socket'}</button>
        <a href="stations.html">Back to stations</a>
      </div>
    </div>`;
  $('kwh').addEventListener('input', upd);
  $('sel').addEventListener('click', () => {
    const kwh = parseFloat($('kwh').value), slot = new Date($('slot').value), err = $('err');
    const bad = !(kwh > 0) ? 'Enter how many kWh you want to charge.'
      : isNaN(slot.getTime()) ? 'Pick an arrival date and time.'
      : slot.getTime() < Date.now() - 300000 ? 'Arrival time must be in the future.' : '';
    if (bad) { err.textContent = bad; err.hidden = false; return; }
    cart.set({ product_id: p.id, kwh, slot_start: slot.toISOString() });
    window.location.href = 'cart.html';
  });
  upd();
}
init();
