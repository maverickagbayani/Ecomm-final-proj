// Stations (Browse): Fetch → Transform → Render.
// Search and filters are sent to the API (/api/stations?q=&connector=&access=); sorting happens here.
var stationList = $("station-list");
var stations = [];       // last list from the API
var sortKey = "nearest"; // 'nearest' | 'availability' | 'price'

// Transform: order the list for the chosen sort
function sortStations(list) {
  var copy = list.slice();
  copy.sort(function (a, b) {
    if (sortKey === "price") return a.pricePerKwh - b.pricePerKwh;
    if (sortKey === "availability") return b.freeSockets - a.freeSockets;
    return distanceKm(QC_CENTER, a.location.coordinates) - distanceKm(QC_CENTER, b.location.coordinates);
  });
  return copy;
}

// Render
function renderDirectory() {
  if (!stations.length) return showState(stationList, "empty", "No stations match your search. Try another area or clear the filters.");
  stationList.innerHTML = sortStations(stations).map(function (s) {
    return stationCard(s, distanceKm(QC_CENTER, s.location.coordinates).toFixed(1) + " km from QC Circle");
  }).join("");
}

// Fetch
var requestNo = 0;
async function loadStations() {
  var mine = ++requestNo; // ignore answers to older searches that arrive late
  var params = new URLSearchParams();
  if ($("q").value.trim()) params.set("q", $("q").value.trim());
  if ($("connector").value) params.set("connector", $("connector").value);
  if ($("pricing").value) params.set("access", $("pricing").value);
  showState(stationList, "loading", "Loading stations…");
  try {
    var data = await getJSON("/api/stations?" + params);
    if (mine !== requestNo) return;
    stations = data;
    renderDirectory();
  } catch (e) {
    if (mine !== requestNo) return;
    showState(stationList, "error", "Could not load stations. Check your connection and try again.");
  }
}

// Sort buttons
[["sort-nearest", "nearest"], ["sort-avail", "availability"], ["sort-price", "price"]].forEach(function (pair) {
  $(pair[0]).addEventListener("click", function () {
    sortKey = pair[1];
    document.querySelectorAll(".sort-row .chip").forEach(function (b) { b.setAttribute("aria-pressed", String(b.id === pair[0])); });
    renderDirectory();
  });
});

$("q").addEventListener("input", debounce(loadStations, 300));
$("connector").addEventListener("change", loadStations);
$("pricing").addEventListener("change", loadStations);

loadStations();
