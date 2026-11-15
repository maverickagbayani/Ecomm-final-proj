nav('cart');
(async () => {
  const box = $('box'), c = cart.get();
  if (!c) {
    box.innerHTML = '<h3>Nothing selected yet</h3><div>Choose a station and a time slot to start.</div><a href="/app/directory.html">Browse stations</a>';
    return;
  }
  let p;
  try {
    const r = await fetch('/api/products/' + encodeURIComponent(c.product_id));
    if (!r.ok) throw new Error('missing');
    p = await r.json();
  } catch (e) {
    cart.clear();
    box.innerHTML = '<h3>That station is no longer available</h3><a href="/app/directory.html">Browse stations</a>';
    return;
  }
  const b = billFor(p, c.kwh), full = p.stock < 1;
  box.innerHTML = `
    <div><table>
      <thead><tr><th>Item</th><th>Time slot</th><th>Quantity</th><th>Rate</th><th>Subtotal</th></tr></thead>
      <tbody><tr><td>${esc(p.name)}</td><td>${esc(when(c.slot_start))}</td><td>${esc(c.kwh)} kWh</td><td>${p.price_per_kwh ? peso(p.price_per_kwh) + '/kWh' : 'Free'}</td><td>${peso(b.charging)}</td></tr></tbody>
    </table></div>
    <div><span>Slot reservation fee</span><b>${peso(FEES.reservation)}</b></div>
    <div><span>Refundable overstay deposit</span><b>${peso(FEES.deposit)}</b></div>
    <hr>
    <div><span>Total price</span><span>${peso(b.total)}</span></div>
    ${full ? '<div role="alert">This station is now full. Choose another station.</div>' : ''}
    <a href="${full ? '/app/directory.html' : '/checkout/checkout.html'}">${full ? 'Choose another station' : 'Proceed to checkout'}</a>
    <a href="station.html?id=${p.id}">Change selection</a>
    <button type="button" id="rm">Remove selection</button>`;
  $('rm').addEventListener('click', () => { cart.clear(); window.location.reload(); });
})();
