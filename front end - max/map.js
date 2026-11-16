// Map search: live stations from /api/stations?q=, nearest first. Each result opens its station page.
// The full interactive Mapbox map is Zaira's page at /frontend-map/.
var searchBox = $("search-box");
var searchResults = $("search-results");

function renderResults(items) {
  if (!items.length) return showState(searchResults, "empty", "No stations match. Try another street or area.");
  searchResults.innerHTML = items
    .slice()
    .sort(function (a, b) { return distanceKm(QC_CENTER, a.location.coordinates) - distanceKm(QC_CENTER, b.location.coordinates); })
    .map(function (s) { return stationCard(s, distanceKm(QC_CENTER, s.location.coordinates).toFixed(1) + " km"); })
    .join("");
}

var requestNo = 0;
async function handleSearch(query) {
  var mine = ++requestNo;
  showState(searchResults, "loading", "Searching…");
  try {
    var items = await getJSON("/api/stations?q=" + encodeURIComponent(query.trim()));
    if (mine === requestNo) renderResults(items);
  } catch (e) {
    if (mine === requestNo) showState(searchResults, "error", "Could not load stations. Try again.");
  }
}

searchBox.addEventListener("input", debounce(function () { handleSearch(searchBox.value); }, 300));
handleSearch("");
