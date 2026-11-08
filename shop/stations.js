nav('stations');
async function load() {
  const list = $('list');
  try {
    const items = await (await fetch('/api/products?q=' + encodeURIComponent($('q').value.trim()))).json();
    list.innerHTML = items.length ? items.map(p => `
      <div>
        <div><h3>${esc(p.name)}</h3><span>${p.stock < 1 ? 'Full' : p.stock + ' free'}</span></div>
        <div>${esc(p.address)}</div>
        <div>${esc(p.connector)} · ${p.power_kw} kW · ${p.price_per_kwh ? peso(p.price_per_kwh) + '/kWh' : 'Free charging'}</div>
        <a href="station.html?id=${p.id}">View details</a>
      </div>`).join('') : '<div>No stations match your search.</div>';
  } catch (e) {
    list.innerHTML = '<div>Could not load stations. Refresh the page to try again.</div>';
  }
}
$('q').addEventListener('input', load);
load();
