var stationList = document.getElementById("station-list");

// placeholders 
var STATIONS = [
  { name: "UP Town Center", distance: 0.8, free: 4, price: 26 },
  { name: "Eastwood Mall", distance: 3.1, free: 2, price: 0 },
  { name: "SM North EDSA", distance: 4.4, free: 1, price: 24 },
  { name: "Trinoma", distance: 5.0, free: 0, price: 28 },
  { name: "Katipunan Hub", distance: 2.2, free: 3, price: 25 }
];

function sortStations(list, sortKey) {
  var copy = list.slice();
  
  copy.sort(function (a, b) {
    if (sortKey === "price") {
      // Lowest price first
      return a.price < b.price ? -1 : a.price > b.price ? 1 : 0;
    } else if (sortKey === "distance") {
      // Nearest first
      return a.distance < b.distance ? -1 : a.distance > b.distance ? 1 : 0;
    } else if (sortKey === "availability") {
      // Highest availability first
      return b.free < a.free ? -1 : b.free > a.free ? 1 : 0;
    }
    return 0;
  });
  
  return copy;
}

function renderDirectory(items) {
  stationList.innerHTML = "";
  
  items.forEach(function (station) {
    var li = document.createElement("li");
    li.className = "glass-card";
    li.style.marginBottom = "15px";
    li.style.width = "100%";
    li.style.maxWidth = "100%";
    
    var priceText = station.price === 0 ? "Free" : "₱" + station.price + "/kWh";
    
    li.innerHTML = `
      <div style="display: flex; justify-content: space-between;">
        <div>
          <h3 style="margin-top: 0; margin-bottom: 5px;">${station.name}</h3>
          <span class="muted">${station.distance} km · ${priceText}</span>
        </div>
        <div>
          <strong>${station.free} free sockets</strong>
        </div>
      </div>
    `;
    
    stationList.append(li);
  });
}

// Event Listeners for the sorting buttons
document.getElementById("sort-nearest").addEventListener("click", function () {
  renderDirectory(sortStations(STATIONS, "distance"));
});

document.getElementById("sort-avail").addEventListener("click", function () {
  renderDirectory(sortStations(STATIONS, "availability"));
});

document.getElementById("sort-price").addEventListener("click", function () {
  renderDirectory(sortStations(STATIONS, "price"));
});

// Initial load (defaulting to Nearest)
renderDirectory(sortStations(STATIONS, "distance"));