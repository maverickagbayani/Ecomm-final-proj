(function () {
  function esc(v) {
    return String(v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  var main = document.querySelector("main");
  if (!main) return;
  var sec = document.createElement("section");
  sec.innerHTML = '<h2 style="color: white;">Featured stations</h2><ul id="featured-list" style="list-style: none; padding: 0;"><li style="color: white;">Loading...</li></ul>';
  main.appendChild(sec);

  var list = document.getElementById("featured-list");
  fetch("/api/products")
    .then(function (res) { if (!res.ok) throw new Error("failed"); return res.json(); })
    .then(function (items) {
      list.innerHTML = items.slice(0, 3).map(function (s) {
        var price = s.price_per_kwh === 0 ? "Free" : "₱" + s.price_per_kwh + "/kWh";
        return '<li class="glass-card" style="margin-bottom: 15px;">' +
          '<a href="station.html?id=' + s.id + '" style="text-decoration: none; color: inherit; display: block;">' +
          '<h3 style="margin-top: 0;">' + esc(s.name) + '</h3>' +
          '<span class="muted">' + price + '</span><br>' +
          '<strong>' + s.stock + ' free sockets</strong></a></li>';
      }).join("");
    })
    .catch(function () {
      list.innerHTML = '<li style="color: white;">Could not load featured stations.</li>';
    });
})();