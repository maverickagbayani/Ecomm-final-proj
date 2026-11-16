// Home: featured stations from the API (the three with the most free sockets right now),
// plus the saved car from the setup pages.

// Shows the saved car, if any
(function () {
  var car = savedVehicle();
  if (car) {
    $("vehicle-line").textContent = "Your car: " + [car.make, car.model].filter(Boolean).join(" ") + " (" + car.battery + " kWh)";
    $("vehicle-btn").textContent = "Change your car";
  }
})();

(async function () {
  var list = $("featured-list");
  showState(list, "loading", "Loading stations…");
  try {
    var stations = await getJSON("/api/stations");
    if (!stations.length) return showState(list, "empty", "No stations yet. Check back soon.");
    var top = stations.slice().sort(function (a, b) { return b.freeSockets - a.freeSockets; }).slice(0, 3);
    list.innerHTML = top.map(stationCard).join("");
  } catch (e) {
    showState(list, "error", "Could not load stations. Refresh the page to try again.");
  }
})();
