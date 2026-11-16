// Shared helpers for the owner pages (dashboard and report form).
const $ = id => document.getElementById(id);
const peso = n => '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const when = iso => new Date(iso).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' });

// GET JSON from our API; throws with the API's message if it fails
async function getJSON(url) {
  const res = await fetch(url);
  let data = null;
  try { data = await res.json(); } catch (e) {}
  if (!res.ok) throw new Error((data && data.error) || `Request failed (${res.status})`);
  return data;
}

// Draws the top bar into <header id="nav" class="topbar">
function nav(on) {
  $('nav').innerHTML = '<div class="logo"><a href="/owner/owner.html">WattSpot Owner</a></div><nav class="topbar-links">' +
    [['owner', 'Dashboard', '/owner/owner.html'], ['report', 'Report issue', '/owner/report.html'], ['site', 'Customer site', '/app/index.html']]
      .map(([k, l, h]) => `<a href="${h}"${k === on ? ' aria-current="page"' : ''}>${l}</a>`).join('') + '</nav>';
}
