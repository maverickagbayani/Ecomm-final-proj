/* ============================================================
   WattSpot interactive map
   - Loads stations (from stations.json now, from the real API later)
   - Shows colored pins on a Mapbox map
   - Filter chips + search box
   - "Nearby hubs" list
   - Bottom sheet when a pin or a card is tapped
   ============================================================ */

/* ---------- settings (come from config.js) ---------- */
const TOKEN = typeof MAPBOX_TOKEN !== "undefined" ? MAPBOX_TOKEN : "";
const API = typeof API_URL !== "undefined" ? API_URL : "stations.json";

// If API_URL ends with ".json" we read a local file and filter in the browser.
// Otherwise we call the real back end and send the filters as URL parameters.
const USE_API = !API.endsWith(".json");

const CENTER = [121.0437, 14.676]; // [longitude, latitude] — Quezon City

/* ---------- app state ---------- */
const state = {
  connector: "", // "CCS2" | "Type2" | ""
  pricing: "", // "FREE" | "PAID" | ""
  query: "", // search box text
  stations: [], // everything we loaded
  selectedId: null,
};

let map = null;
let markers = [];

/* ---------- small helpers ---------- */

// Free-socket percentage -> color level (same rules as the design)
// 75-100% green, 50-74% yellow, 25-49% orange, 0-24% red
function level(station) {
  const pct = (station.freeSockets / station.totalSockets) * 100;
  if (pct >= 75) return "ok";
  if (pct >= 50) return "yl";
  if (pct >= 25) return "or";
  return "rd";
}

// Distance in km between two [lng, lat] points
function distanceKm([lng1, lat1], [lng2, lat2]) {
  const rad = (d) => (d * Math.PI) / 180;
  const a =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

// Stops station names from breaking the page if they contain < or >
function esc(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

const priceText = (s) =>
  s.pricing === "FREE" ? "Free" : "₱" + s.pricePerKwh + "/kWh";

const connectorText = (s) =>
  s.connectors.map((c) => (c === "Type2" ? "Type 2 AC" : c + " DC")).join(" · ");

/* ---------- 1. load the data ---------- */
async function fetchStations() {
  let url = API;

  if (USE_API) {
    const params = new URLSearchParams({ near: "QC" });
    if (state.connector) params.set("connector", state.connector);
    if (state.pricing) params.set("pricing", state.pricing);
    url += (API.includes("?") ? "&" : "?") + params;
  }

  const res = await fetch(url);
  if (!res.ok) throw new Error("Could not load stations (" + res.status + ")");
  return res.json();
}

async function loadStations() {
  try {
    state.stations = await fetchStations();
    render();
  } catch (err) {
    document.getElementById("list").innerHTML =
      '<p class="empty">Could not load stations. ' + esc(err.message) + "</p>";
  }
}

/* ---------- 2. decide which stations to show ---------- */
function visibleStations() {
  let list = state.stations;

  // When reading the local file, the browser does the filtering.
  // With the real API, the back end already filtered.
  if (!USE_API) {
    if (state.connector) list = list.filter((s) => s.connectors.includes(state.connector));
    if (state.pricing) list = list.filter((s) => s.pricing === state.pricing);
  }

  if (state.query) {
    const q = state.query.toLowerCase();
    list = list.filter((s) => s.name.toLowerCase().includes(q));
  }

  // nearest first
  return [...list].sort(
    (a, b) =>
      distanceKm(CENTER, a.location.coordinates) -
      distanceKm(CENTER, b.location.coordinates)
  );
}

/* ---------- 3. draw everything ---------- */
function render() {
  const stations = visibleStations();
  renderPins(stations);
  renderList(stations);
}

function renderPins(stations) {
  markers.forEach((m) => m.remove());
  markers = [];
  if (!map) return;

  stations.forEach((s) => {
    const el = document.createElement("div"); // Mapbox moves this element
    const pin = document.createElement("div"); // we style this one
    const lv = level(s);
    pin.className = "pin " + lv + " " + lv + "-bg";
    pin.textContent = "⚡ " + s.freeSockets + "/" + s.totalSockets;
    el.appendChild(pin);
    el.addEventListener("click", () => selectStation(s));

    markers.push(
      new mapboxgl.Marker({ element: el }).setLngLat(s.location.coordinates).addTo(map)
    );
  });
}

function renderList(stations) {
  const list = document.getElementById("list");

  if (stations.length === 0) {
    list.innerHTML = '<p class="empty">No stations match your filters.</p>';
    return;
  }

  list.innerHTML = "";
  stations.forEach((s) => {
    const km = distanceKm(CENTER, s.location.coordinates).toFixed(1);
    const lv = level(s);

    const card = document.createElement("div");
    card.className = "card" + (s.id === state.selectedId ? " sel" : "");
    card.innerHTML = `
      <div class="card-body">
        <div class="card-name">${esc(s.name)}</div>
        <div class="card-sub">${km} km · ${esc(connectorText(s))} · ${esc(priceText(s))}</div>
      </div>
      <span class="tag ${lv} ${lv}-bg">${s.freeSockets > 0 ? s.freeSockets + " free" : "Full"}</span>`;
    card.addEventListener("click", () => selectStation(s));
    list.appendChild(card);
  });
}

/* ---------- 4. pick a station -> fly there + open the bottom sheet ---------- */
function selectStation(s) {
  state.selectedId = s.id;

  if (map) map.flyTo({ center: s.location.coordinates, zoom: 14 });

  const [lng, lat] = s.location.coordinates;
  const sheet = document.getElementById("sheet");
  sheet.hidden = false;
  sheet.innerHTML = `
    <div class="sheet-head">
      <div>
        <h3>${esc(s.name)}</h3>
        <p>${s.freeSockets} of ${s.totalSockets} sockets free · ${esc(priceText(s))}</p>
        <p>${esc(connectorText(s))}</p>
      </div>
      <button class="sheet-close" id="sheet-close" aria-label="Close">✕</button>
    </div>
    <div class="sheet-actions">
      <!-- TODO (team): link this to the Station Detail / Check-in page -->
      <button class="btn">View station</button>
      <a class="btn o" target="_blank" rel="noopener"
         href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}">Directions</a>
    </div>`;

  document.getElementById("sheet-close").addEventListener("click", closeSheet);
  renderList(visibleStations()); // refresh the highlighted card
}

function closeSheet() {
  state.selectedId = null;
  document.getElementById("sheet").hidden = true;
  renderList(visibleStations());
}

/* ---------- 5. filter chips ---------- */
document.getElementById("chips").addEventListener("click", (e) => {
  const chip = e.target.closest(".pill");
  if (!chip) return;

  const { group, value } = chip.dataset;

  if (group === "all") {
    state.connector = "";
    state.pricing = "";
  } else if (state[group] === value) {
    state[group] = ""; // tapping an active chip turns it off
  } else {
    state[group] = value;
  }

  // update which chips look active
  document.querySelectorAll("#chips .pill").forEach((p) => {
    const g = p.dataset.group;
    const on =
      g === "all" ? !state.connector && !state.pricing : state[g] === p.dataset.value;
    p.classList.toggle("on", on);
  });

  if (USE_API) loadStations(); // ask the back end again with the new filters
  else render();
});

/* ---------- 6. search box ---------- */
document.getElementById("search").addEventListener("input", (e) => {
  state.query = e.target.value.trim();
  render();
});

/* ---------- 7. start the map ---------- */
function startMap() {
  if (!TOKEN || TOKEN.includes("PASTE")) {
    const notice = document.getElementById("notice");
    notice.hidden = false;
    notice.innerHTML =
      "<div><b>The map needs a Mapbox token.</b><br>" +
      "Create <code>config.js</code> (copy <code>config.example.js</code>) " +
      "and paste your token inside.<br>The station list still works.</div>";
    return;
  }

  mapboxgl.accessToken = TOKEN;
  map = new mapboxgl.Map({
    container: "map",
    style: "mapbox://styles/mapbox/light-v11",
    center: CENTER,
    zoom: 11.5,
  });

  map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
  map.on("load", render);
}

startMap();
loadStations();

// keep availability fresh when using the real back end
if (USE_API) setInterval(loadStations, 15000);
