nav('cart');
const RES = 50, DEP = 100;      // display only; the server calculates the real total
let products = [], method = 'Card';

let sel = null;
async function load() {
  sel = JSON.parse(localStorage.getItem('wattspot_cart') || 'null');
  if (!sel) { window.location.href = '/shop/stations.html'; return; }
  try {
    const r = await fetch('/api/products/' + encodeURIComponent(sel.product_id));
    if (!r.ok) throw new Error('missing');
    products = [await r.json()];
  } catch (e) {
    return showError('Could not load your selection. Go back to the cart and try again.');
  }
  $('socket').innerHTML = '<option value="' + products[0].id + '"></option>';
  $('socket').value = products[0].id;
  $('kwh').value = sel.kwh;
  $('sel').textContent = products[0].name + ' · ' + new Date(sel.slot_start).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });
  bill();
}

function bill() {
  const p = products.find(x => x.id == $('socket').value);
  const kwh = parseFloat($('kwh').value) || 0;
  const charge = p ? Math.round(p.price_per_kwh * kwh * 100) / 100 : 0;
  $('sum-name').textContent = p ? p.name : '';
  $('l-charge').textContent = `Charging fee (${kwh} kWh × ₱${p ? p.price_per_kwh : 0})`;
  $('a-charge').textContent = peso(charge);
  $('a-res').textContent = peso(RES);
  $('a-dep').textContent = peso(DEP);
  $('total').textContent = $('total2').textContent = peso(charge + RES + DEP);
}

function showError(t) { const m = $('message'); m.hidden = false; m.textContent = t; }
function openModal(open) { $('modal').hidden = !open; }

$('socket').addEventListener('change', bill);
$('kwh').addEventListener('input', bill);
$('go').addEventListener('click', () => {
  $('message').hidden = true;
  if (!$('f').reportValidity()) return;
  if (!products.some(p => p.id == $('socket').value && p.stock > 0)) return showError('Pick a station with a free socket.');
  openModal(true);
});
$('cancel').addEventListener('click', () => openModal(false));
document.addEventListener('keydown', e => { if (e.key === 'Escape') openModal(false); });

document.querySelectorAll('[data-m]').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('[data-m]').forEach(o => o.setAttribute('aria-pressed', 'false'));
  b.setAttribute('aria-pressed', 'true');
  method = b.dataset.m;
  $('chosen').textContent = 'Selected: ' + method;
}));

$('pay').addEventListener('click', async () => {
  const btn = $('pay'), err = $('pay-error');
  err.hidden = true;
  btn.disabled = true; btn.textContent = 'Processing…';
  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name: $('name').value.trim(),
        customer_email: $('email').value.trim(),
        payment_method: method,
        product_id: Number($('socket').value),
        kwh: parseFloat($('kwh').value),
        slot_start: sel.slot_start
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Order failed');
    localStorage.removeItem('wattspot_cart');
    window.location.href = 'confirmation.html?id=' + data.id;
  } catch (e) {
    err.textContent = e.message; err.hidden = false;
    btn.disabled = false; btn.textContent = 'Pay securely';
  }
});

load();
