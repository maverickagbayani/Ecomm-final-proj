// Shared helpers for the customer pages (Home, Stations, Map, Station).
// The server always recomputes prices and checks slots; numbers shown here are previews.

var $ = function (id) { return document.getElementById(id); };

// Stops text from the database breaking the page if it contains < or >
function esc(v) {
  return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

function peso(n) {
  return "₱" + Number(n).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function priceText(pricePerKwh) {
  return Number(pricePerKwh) === 0 ? "Free charging" : peso(pricePerKwh) + "/kWh";
}

function connectorText(codes) {
  return codes.map(function (c) { return c === "Type2" ? "Type 2 AC" : c + " DC"; }).join(" · ");
}

// GET a URL from our API and return the JSON. Throws an Error with the API's message if it fails.
async function getJSON(url) {
  var res = await fetch(url);
  var data = null;
  try { data = await res.json(); } catch (e) { /* not JSON */ }
  if (!res.ok) {
    var err = new Error((data && data.error) || "Request failed (" + res.status + ")");
    err.status = res.status;
    throw err;
  }
  return data;
}

// Shows a loading / empty / error message inside an element
function showState(el, kind, text) {
  el.innerHTML = '<p class="state state-' + kind + '">' + esc(text) + "</p>";
}

// The selection carried to the cart and checkout pages (same key the shop pages use)
var cart = {
  get: function () { try { return JSON.parse(localStorage.getItem("wattspot_cart")); } catch (e) { return null; } },
  set: function (c) { try { localStorage.setItem("wattspot_cart", JSON.stringify(c)); } catch (e) { /* storage blocked */ } },
};

// Saved vehicle from the setup pages ({ make, model, battery, speed }), or null
function savedVehicle() {
  try { return JSON.parse(localStorage.getItem("wattspot_vehicle")); } catch (e) { return null; }
}

// Distance in km between two [lng, lat] points
var QC_CENTER = [121.0498, 14.6516]; // Quezon Memorial Circle
function distanceKm(a, b) {
  var rad = function (d) { return (d * Math.PI) / 180; };
  var h = Math.pow(Math.sin(rad(b[1] - a[1]) / 2), 2) +
    Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.pow(Math.sin(rad(b[0] - a[0]) / 2), 2);
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

// Dates in Manila time (the server's booking calendar), whatever the visitor's time zone
var manilaDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }); // → 'YYYY-MM-DD'
var manilaDay = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", weekday: "short", month: "short", day: "numeric" });

// '14:30' → '2:30 PM'
function clock12(hhmm) {
  var parts = hhmm.split(":"), h = Number(parts[0]);
  return ((h + 11) % 12) + 1 + ":" + parts[1] + " " + (h < 12 ? "AM" : "PM");
}

// One station (from /api/stations) → a card that links to its station page.
// `extra` is an optional line of text, e.g. the distance.
function stationCard(s, extra) {
  var badge = s.freeSockets === 0 ? "full" : s.freeSockets / s.totalSockets < 0.5 ? "low" : "";
  return '<li class="glass-card">' +
    '<a class="station-link" href="station.html?id=' + encodeURIComponent(s.id) + '">' +
    "<div><h3>" + esc(s.name) + "</h3>" +
    "<p>" + esc(connectorText(s.connectors)) + " · " + esc(priceText(s.pricePerKwh)) + "</p>" +
    "<p>" + esc(s.hours) + (extra ? " · " + esc(extra) : "") + "</p></div>" +
    '<span class="badge ' + badge + '">' + (s.freeSockets === 0 ? "Full now" : s.freeSockets + " of " + s.totalSockets + " free") + "</span>" +
    "</a></li>";
}

function debounce(fn, ms) {
  var t;
  return function () {
    var args = arguments;
    clearTimeout(t);
    t = setTimeout(function () { fn.apply(null, args); }, ms);
  };
}
