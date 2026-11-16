// Report an issue: POST /api/reports. The plug list comes from GET /api/products.
nav('report');
const preselect = new URLSearchParams(location.search).get('station');
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function show(text, ok) {
  const m = $('message');
  m.hidden = false;
  m.className = ok ? 'ok-msg' : 'error-msg';
  m.textContent = text;
}

(async () => {
  try {
    const items = await getJSON('/api/products');
    if (!items.length) { $('station').innerHTML = '<option value="">No stations yet</option>'; return; }
    $('station').innerHTML = '<option value="">Choose a station…</option>' +
      items.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
    $('station').disabled = false;
    if (preselect) $('station').value = preselect;
  } catch (e) {
    $('station').innerHTML = '<option value="">Could not load stations</option>';
    show('Could not load stations. Refresh the page to try again.');
  }
})();

$('f').addEventListener('submit', async e => {
  e.preventDefault();
  $('message').hidden = true;
  const desc = $('desc').value.trim(), email = $('email').value.trim(), errs = [];
  if (!$('station').value) errs.push('Choose a station.');
  if (desc.length < 10) errs.push('Describe the problem in at least 10 characters.');
  if (email && !EMAIL.test(email)) errs.push('Enter a valid email address or leave it blank.');
  if (errs.length) return show(errs.join(' '));

  const btn = $('send');
  btn.disabled = true; btn.textContent = 'Sending…';
  try {
    const res = await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        station_id: $('station').value,
        issue_type: $('type').value,
        description: desc,
        reporter_name: $('name').value.trim(),
        reporter_email: email
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not send the report');
    $('f').reset();
    if (preselect) $('station').value = preselect;
    show(`Thank you. Report #${String(data.id).slice(-6).toUpperCase()} was sent to the station owner.`, true);
  } catch (err) {
    show(err.message || 'Could not send the report. Try again.');
  } finally {
    btn.disabled = false; btn.textContent = 'Send report';
  }
});
