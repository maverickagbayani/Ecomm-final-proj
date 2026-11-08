var stationList = document.getElementById("station-list");

// placeholders
var STATIONS = [
  { 
    name: "UP Town Center", 
    address: "Katipunan Ave, Quezon City",
    stock: 4, 
    price_per_kwh: 26, 
    power_kw: 50, 
    connector: "Type 2" 
  },
  { 
    name: "Eastwood Mall", 
    address: "Bagumbayan, Quezon City", 
    stock: 2, 
    price_per_kwh: 0, 
    power_kw: 22, 
    connector: "Type 2" 
  },
  { 
    name: "SM North EDSA", 
    address: "Bago Bantay, Quezon City", 
    stock: 12, 
    price_per_kwh: 28, 
    power_kw: 120, 
    connector: "CCS2" 
  }
];

function sortStations(list, sortKey) {
  var copy = list.slice();

  copy.sort(function (a, b) {
    if (sortKey === "price") {
      // Lowest price first
      return a.price_per_kwh < b.price_per_kwh ? -1 : a.price_per_kwh > b.price_per_kwh ? 1 : 0;
    } else if (sortKey === "distance") {
      // Alphabetical by address (since distance is removed)
      return a.address < b.address ? -1 : a.address > b.address ? 1 : 0;
    } else if (sortKey === "availability") {
      // Highest availability first
      return b.stock < a.stock ? -1 : b.stock > a.stock ? 1 : 0;
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

    var priceText = station.price_per_kwh === 0 ? "Free" : "₱" + station.price_per_kwh + "/kWh";

    li.innerHTML = `
      <div style="display: flex; justify-content: space-between;">
        <div>
          <h3 style="margin-top: 0; margin-bottom: 5px;">${station.name}</h3>
          <span class="muted">${station.address} - ${priceText}</span>
        </div>
        <div>
          <strong>${station.stock} free sockets</strong>
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