var carSearch = document.getElementById("car-search");
var carList = document.getElementById("car-list");

// Common EVs in the Philippines: battery capacity (kWh) and max DC charging speed (kW).
// Reference data for the picker only; nothing here is a booking or a price.
var CARS = [
  { make: "BYD", model: "Atto 3", battery: 60.5, speed: 88 },
  { make: "BYD", model: "Dolphin", battery: 44.9, speed: 60 },
  { make: "BYD", model: "Seal", battery: 82.5, speed: 150 },
  { make: "Hyundai", model: "Ioniq 5", battery: 77.4, speed: 233 },
  { make: "Kia", model: "EV6", battery: 77.4, speed: 233 },
  { make: "MG", model: "4 EV", battery: 64, speed: 135 },
  { make: "Nissan", model: "Leaf", battery: 40, speed: 50 },
  { make: "Tesla", model: "Model 3", battery: 60, speed: 170 },
  { make: "Tesla", model: "Model Y", battery: 75, speed: 250 },
  { make: "Porsche", model: "Taycan", battery: 93.4, speed: 270 }
];

function selectCar(car) {
  try { localStorage.setItem("wattspot_vehicle", JSON.stringify(car)); } catch (e) { /* storage blocked */ }
  window.location.href = "setup-specs.html";
}

function renderCars(items) {
  carList.innerHTML = "";
  if (!items.length) {
    carList.innerHTML = '<li class="state">No match. Pick "My car isn\'t listed" below.</li>';
  }
  items.concat([{ make: "My car", model: "isn't listed", battery: "", speed: "", custom: true }]).forEach(function (car) {
    var li = document.createElement("li");
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "glass-card";
    btn.style.cssText = "width: 100%; max-width: 100%; text-align: left; cursor: pointer; font-size: 1rem;";
    btn.innerHTML = "<strong></strong>";
    btn.querySelector("strong").textContent = car.make + " " + car.model;
    btn.addEventListener("click", function () {
      selectCar(car.custom ? { make: "", model: "My EV", battery: "", speed: "" } : car);
    });
    li.appendChild(btn);
    carList.appendChild(li);
  });
}

renderCars(CARS);

carSearch.addEventListener("input", function () {
  var needle = carSearch.value.trim().toLowerCase();
  renderCars(CARS.filter(function (car) {
    return (car.make + " " + car.model).toLowerCase().indexOf(needle) !== -1;
  }));
});
