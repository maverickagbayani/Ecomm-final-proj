nav('owner');

async function load() {
  try {
    const [m, orders] = await Promise.all([
      fetch('/api/metrics').then(r => r.json()),
      fetch('/api/orders').then(r => r.json())
    ]);
    $('m-orders').textContent = m.total_orders;
    $('m-revenue').textContent = peso(m.total_revenue);
    $('m-aov').textContent = peso(m.average_order_value);
    const t = m.top_selling_station;
    $('m-top').textContent = t ? t.name : 'No orders yet';
    $('m-top-sub').textContent = t ? `${t.orders} booking${t.orders === 1 ? '' : 's'} · ${t.kwh} kWh` : '';
    $('m-low').innerHTML = m.low_stock.length
      ? m.low_stock.map(s => `<li><span>${esc(s.name)}</span><b>${s.available_slots} open</b></li>`).join('')
      : '<li>All stations well stocked</li>';
    $('rows').innerHTML = orders.length
      ? orders.map(o => `<tr><td>#${esc(o.id)}</td><td>${esc(o.customer_name)}</td><td>${esc(o.customer_email)}</td><td>${esc(o.socket)}</td><td>${esc(o.kwh)}</td><td>${esc(o.payment_method)}</td><td>${peso(o.total)}</td><td>${esc(new Date(o.createdAt).toLocaleString())}</td></tr>`).join('')
      : '<tr><td colspan="8">No bookings yet.</td></tr>';
    $('updated').textContent = 'Updated ' + new Date().toLocaleTimeString();
  } catch (e) {
    $('rows').innerHTML = '<tr><td colspan="8">Could not load data. Is the server running?</td></tr>';
  }
}

$('refresh').addEventListener('click', load);
load();
setInterval(load, 10000);
