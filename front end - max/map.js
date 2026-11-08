var searchBox = document.getElementById("search-box");
var sidebar = document.getElementById("nearby-sidebar");
var searchResults = document.getElementById("search-results");

// Mock Database of stations
var STATIONS = [
  { name: "UP Town Center", distance: "0.8 km", status: "4 free" },
  { name: "Eastwood Mall", distance: "3.1 km", status: "2 free" },
  { name: "SM North EDSA", distance: "4.4 km", status: "1 free" }
];

function debounce(fn, delay) {
  var timer;
  return function () {
    var args = arguments;
    clearTimeout(timer);
    timer = setTimeout(function () {
      fn.apply(null, args);
    }, delay);
  };
}

function renderResults(items) {
  searchResults.innerHTML = "";
  
  items.forEach(function (station) {
    var li = document.createElement("li");
    li.className = "glass-card";
    li.style.marginBottom = "10px";
    li.innerHTML = `<strong>${station.name}</strong><br>${station.distance} — ${station.status}`;
    searchResults.append(li);
  });
}

function handleSearch(query) {
  var needle = query.trim().toLowerCase();
  
  if (needle === "") {
    // Hide sidebar if search is empty
    sidebar.classList.add("hidden");
    return;
  }

  // Show sidebar
  sidebar.classList.remove("hidden");

  var results = STATIONS.filter(function (station) {
    return station.name.toLowerCase().indexOf(needle) !== -1;
  });

  renderResults(results);
}

// Attach debounced event listener
searchBox.addEventListener(
  "input",
  debounce(function () {
    handleSearch(searchBox.value);
  }, 300)
);