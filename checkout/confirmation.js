nav('stations');
const row = (label, value) => `<div><span>${label}</span><b>${value}</b></div>`;
const box = document.getElementById('details');
const orderId = new URLSearchParams(window.location.search).get('id');

if (!orderId) {
  box.innerHTML = '<h3>No order found</h3><div>Open this page from the checkout, or add ?id= and your order number to the link.</div><a href="checkout.html">Back to checkout</a>';
} else {
  fetch('/api/orders/' + encodeURIComponent(orderId))
    .then(res => {
      if (!res.ok) throw new Error('Order not found. The server may have restarted, so place the order again.');
      return res.json();
    })
    .then(o => {
      const b = o.breakdown || {};
      box.innerHTML = `
        <span>✓</span>
        <h2>Reservation confirmed</h2>
        <div>Order #${esc(o.id)} · ${esc(new Date(o.createdAt).toLocaleString())}</div>
        <hr>
        ${row('Customer', esc(o.customer_name))}
        ${row('Email', esc(o.customer_email))}
        ${row('Socket', esc(o.socket || ''))}
        ${row('Energy booked', esc(o.kwh) + ' kWh')}
        ${o.slot_start ? row('Arrival slot', esc(new Date(o.slot_start).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }))) : ''}
        <hr>
        ${row('Charging fee', peso(b.charging ?? 0))}
        ${row('Slot reservation fee', peso(b.reservation_fee ?? 0))}
        ${row('Refundable overstay deposit', peso(b.deposit ?? 0))}
        ${row('Paid with', esc(o.payment_method || ''))}
        <div>
          <span>Total paid</span><span>${peso(o.total)}</span>
        </div>
        <div>
          <button type="button" onclick="window.print()">Download receipt</button>
          <a href="/shop/stations.html">Book another socket</a>
        </div>`;
    })
    .catch(err => {
      box.innerHTML = `<h3>Something went wrong</h3><div>${esc(err.message)}</div><a href="checkout.html">Back to checkout</a>`;
    });
}
