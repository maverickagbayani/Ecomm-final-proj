// Checkout (Confirm): customer details with validation messages, simulated payment,
// and the server's itemised bill (POST /api/bookings/quote). Saving is POST /api/bookings.
nav('cart');
let sel = null, q = null, method = 'Card';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function showError(t) { const m = $('message'); m.hidden = !t; m.textContent = t || ''; }
function openModal(open) { $('modal').hidden = !open; if (open) $('pay').focus(); }

// Shows (or clears) the message under one field
function fieldError(id, text) {
  const p = $('err-' + id);
  p.hidden = !text;
  p.textContent = text || '';
  $(id).setAttribute('aria-invalid', text ? 'true' : 'false');
}

// The same rules the server checks (server/validate.js). Returns true if the form is OK.
function validate() {
  const name = $('name').value.trim(), email = $('email').value.trim();
  fieldError('name', !name ? 'Enter your name.' : name.length < 2 ? 'Name must be at least 2 characters.' : '');
  fieldError('email', !email ? 'Enter your email.' : !EMAIL.test(email) ? 'Enter a valid email address, e.g. juan@gmail.com.' : '');
  const firstBad = ['name', 'email'].find(id => !$('err-' + id).hidden);
  if (firstBad) $(firstBad).focus();
  return !firstBad;
}

// Shows the server's quote in the itemised bill
function renderBill() {
  const b = q.breakdown;
  $('sel').textContent = `${when(q.slot_start)} – ${clock(q.slot_end)} · ${q.vehicle.model}, ${q.start_pct}% → ${q.target_pct}%`;
  $('sum-name').textContent = q.socket;
  $('l-charge').textContent = `Charging (${q.kwh} kWh × ${b.price_per_kwh ? peso(b.price_per_kwh) : 'free'})`;
  $('a-charge').textContent = peso(b.charging);
  $('a-res').textContent = peso(b.reservation_fee);
  $('a-dep').textContent = peso(b.deposit);
  $('total').textContent = $('total2').textContent = peso(q.total);
  $('go').disabled = !q.available;
}

async function load() {
  sel = cart.get();
  if (!sel) {
    $('sel').textContent = 'Nothing selected yet.';
    return showError('Your cart is empty. Choose a station and a start time first.');
  }
  try {
    const r = await quote(sel);
    if (!r.ok) {
      $('sel').textContent = '';
      return showError((r.data.error || 'This selection needs a change.') + ' Go back to the cart to choose again.');
    }
    q = r.data;
  } catch (e) {
    $('sel').textContent = '';
    return showError('Could not load your selection. Check your connection and refresh.');
  }
  renderBill();
  if (!q.available) showError('Someone just booked this time. Go back to the cart and choose another start time.');
}

['name', 'email'].forEach(id => $(id).addEventListener('blur', () => { if ($(id).value) validate(); }));

$('go').addEventListener('click', () => {
  showError('');
  if (!q) return showError('Your selection is still loading.');
  if (!validate()) return;
  openModal(true);
});
$('cancel').addEventListener('click', () => openModal(false));
document.addEventListener('keydown', e => { if (e.key === 'Escape') openModal(false); });

document.querySelectorAll('[data-m]').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('[data-m]').forEach(o => o.setAttribute('aria-pressed', 'false'));
  b.setAttribute('aria-pressed', 'true');
  method = b.dataset.m;
  $('chosen').textContent = 'Selected: ' + b.textContent;
}));

$('pay').addEventListener('click', async () => {
  const btn = $('pay'), err = $('pay-error');
  err.hidden = true;
  btn.disabled = true; btn.textContent = 'Processing…'; // also stops a double click from sending twice
  try {
    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name: $('name').value.trim(),
        customer_email: $('email').value.trim(),
        payment_method: method,
        connector_id: sel.product_id,
        slot_start: sel.slot_start,
        vehicle: sel.vehicle,
        start_pct: sel.start_pct,
        target_pct: sel.target_pct
      })
    });
    const data = await res.json().catch(() => ({})); // a non-JSON reply shouldn't show "Unexpected token"
    // This customer already booked this exact slot (second tab, or a retry): show that booking
    if (res.status === 409 && data.existing_booking_id) {
      cart.clear();
      window.location.href = 'confirmation.html?id=' + encodeURIComponent(data.existing_booking_id);
      return;
    }
    if (!res.ok) {
      // Field problems go back under the fields; anything else shows in the payment box
      const f = data.fields || {};
      if (f.customer_name || f.customer_email) {
        openModal(false);
        fieldError('name', f.customer_name || '');
        fieldError('email', f.customer_email || '');
        throw null;
      }
      // Someone else took the slot: offer a way back to pick another time instead of a dead end
      if (data.suggested_times) {
        const later = data.suggested_times.map(t => t.time).join(', ');
        err.innerHTML = `${esc(data.error)}${later ? ` Open later that day: ${esc(later)}.` : ''}` +
          `<br><a class="primary-btn" style="margin-top: 10px;" href="${stationLink(q)}">Choose another time</a>`;
        err.hidden = false;
        btn.textContent = 'Slot taken';
        $('go').disabled = true;
        return; // keep Pay disabled: this slot can't be booked any more
      }
      throw new Error(data.error || 'Booking failed');
    }
    cart.clear();
    window.location.href = 'confirmation.html?id=' + encodeURIComponent(data.id);
  } catch (e) {
    if (e) { err.textContent = e.message || 'Could not reach WattSpot. Check your connection and try again.'; err.hidden = false; }
    btn.disabled = false; btn.textContent = 'Pay securely';
  }
});

load();
