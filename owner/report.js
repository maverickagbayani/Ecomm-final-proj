nav('report');
const preselect = new URLSearchParams(location.search).get('station');
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function show(text) {
  const m = $('message');
  m.hidden = false;
  m.textContent = text;
}

(async () => {
  try {
    const r = await fetch('/api/products');
    if (!r.ok) throw new Error('failed');
    const items = await r.json();
    $('station').innerHTML = items.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
    if (preselect) $('station').value = preselect;
  } catch (e) {
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
  btn.disabled = true;
  try {
    const res = await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        station_id: Number($('station').value),
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
    show('Thank you. Report #' + data.id + ' was sent to the station owner.');
  } catch (err) {
    show(err.message);
  } finally {
    btn.disabled = false;
  }
});
