// Owner screen: saved bookings, the five numbers from GET /api/metrics, and incident reports.
// The three requests don't depend on each other, so they load in parallel. Refreshes every 30 s.
nav('owner');

const td = (label, html, cls = '') => `<td data-label="${esc(label)}"${cls ? ` class="${cls}"` : ''}>${html}</td>`;
const emptyRow = text => `<tr><td class="full" colspan="8">${esc(text)}</td></tr>`;

function renderMetrics(m) {
  $('m-orders').textContent = m.total_orders;
  $('m-revenue').textContent = peso(m.total_revenue);
  $('m-aov').textContent = peso(m.average_order_value);
  const t = m.top_selling_station;
  $('m-top').textContent = t ? t.name : 'No bookings yet';
  $('m-top-sub').textContent = t ? `${t.orders} booking${t.orders === 1 ? '' : 's'} · ${t.kwh} kWh` : '';
  $('m-low').innerHTML = m.low_stock.length
    ? m.low_stock.map(s => `<li>${esc(s.name)}: ${esc(s.available_slots)} of ${esc(s.total_slots)} slots open</li>`).join('')
    : '<li>None. Every plug has room today.</li>';
}

function renderBookings(list) {
  $('rows').innerHTML = list.length
    ? list.map(o => '<tr>' +
        td('Ref', `<b>${esc(o.ref)}</b>`) +
        td('Customer', `${esc(o.customer_name)}<br><small>${esc(o.customer_email)}</small>`) +
        td('Station · plug', esc(o.socket)) +
        td('Slot', esc(when(o.slot_start))) +
        td('Charge', `${esc(o.kwh)} kWh${o.start_pct != null ? ` (${esc(o.start_pct)}→${esc(o.target_pct)}%)` : ''}`) +
        td('Payment', esc(o.payment_method)) +
        td('Total', peso(o.total)) +
        td('Booked', esc(when(o.createdAt))) +
        '</tr>').join('')
    : emptyRow('No bookings yet. They appear here as soon as a driver pays.');
}

function renderReports(list) {
  $('reports').innerHTML = list.length
    ? list.map(r => '<tr>' +
        td('Report', '#' + esc(String(r.id).slice(-6).toUpperCase())) +
        td('Station', esc(r.station)) +
        td('Issue', esc(r.issue_type)) +
        td('Details', esc(r.description)) +
        td('Reporter', esc(r.reporter_name || 'Anonymous') + (r.reporter_email ? `<br><small>${esc(r.reporter_email)}</small>` : '')) +
        td('Status', `<span class="status ${esc(r.status)}">${esc(r.status)}</span>`) +
        td('Sent', esc(when(r.createdAt))) +
        td('Action', r.status === 'open' ? `<button type="button" class="primary-btn" data-resolve="${esc(r.id)}">Mark resolved</button>` : '—') +
        '</tr>').join('')
    : emptyRow('No incident reports. Drivers can send one from any station page.');
}

async function load() {
  $('load-error').hidden = true;
  const [m, bookings, reports] = await Promise.allSettled([getJSON('/api/metrics'), getJSON('/api/bookings'), getJSON('/api/reports')]);
  const failed = [];
  if (m.status === 'fulfilled') renderMetrics(m.value); else failed.push('numbers');
  if (bookings.status === 'fulfilled') renderBookings(bookings.value); else { failed.push('bookings'); $('rows').innerHTML = emptyRow('Could not load bookings.'); }
  if (reports.status === 'fulfilled') renderReports(reports.value); else { failed.push('reports'); $('reports').innerHTML = emptyRow('Could not load reports.'); }
  if (failed.length) {
    $('load-error').hidden = false;
    $('load-error').textContent = `Could not load the ${failed.join(', ')}. Check the server and press Refresh.`;
  }
  $('updated').textContent = 'Updated ' + new Date().toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', second: '2-digit' });
}

$('reports').addEventListener('click', async e => {
  const id = e.target.dataset && e.target.dataset.resolve;
  if (!id) return;
  e.target.disabled = true;
  e.target.textContent = 'Saving…';
  try {
    const res = await fetch('/api/reports/' + encodeURIComponent(id) + '/resolve', { method: 'PATCH' });
    if (!res.ok) throw new Error();
  } catch (err) {
    $('load-error').hidden = false;
    $('load-error').textContent = 'Could not mark that report resolved. Try again.';
  }
  load();
});

$('refresh').addEventListener('click', load);
load();
setInterval(load, 30000);
