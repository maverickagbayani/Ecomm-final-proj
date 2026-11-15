const $ = id => document.getElementById(id);
const peso = n => '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const when = iso => new Date(iso).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });
const FEES = { reservation: 50, deposit: 100 }; // display only; the server calculates the real total

const cart = {
  get() { try { return JSON.parse(localStorage.getItem('wattspot_cart')); } catch (e) { return null; } },
  set(c) { try { localStorage.setItem('wattspot_cart', JSON.stringify(c)); } catch (e) {} },
  clear() { try { localStorage.removeItem('wattspot_cart'); } catch (e) {} }
};

function billFor(p, kwh) {
  const charging = Math.round(p.price_per_kwh * kwh * 100) / 100;
  return { charging, total: Math.round((charging + FEES.reservation + FEES.deposit) * 100) / 100 };
}

function nav(on) {
  $('nav').innerHTML = '<strong>WattSpot</strong> | ' +
    [['stations', 'Stations', '/app/directory.html'], ['cart', 'Cart', '/shop/cart.html'], ['owner', 'Owner', '/checkout/owner.html']]
      .map(([k, l, h]) => `<a href="${h}"${k === on ? ' aria-current="page"' : ''}>${l}</a>`).join(' | ');
}
