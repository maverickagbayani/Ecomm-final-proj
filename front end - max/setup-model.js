var carSearch = document.getElementById("car-search");
var carList = document.getElementById("car-list");

// Mock database of cars
var CARS = [
  { make: "Hyundai", model: "Ioniq 5", battery: 77.4, speed: 233 },
  { make: "Porsche", model: "Taycan", battery: 93.4, speed: 270 },
  { make: "Tesla", model: "Model Y", battery: 75.0, speed: 250 },
  { make: "BYD", model: "Seal", battery: 82.5, speed: 150 }
];

function selectCar(carObject) {
  localStorage.setItem("wattspot_vehicle", JSON.stringify(carObject));
  
  // Route to the confirmation page
  window.location.href = "setup-specs.html";
}

function renderCars(items) {
  carList.innerHTML = "";

  items.forEach(function (car) {
    var li = document.createElement("li");
    li.className = "glass-card";
    li.style.marginBottom = "15px";
    li.style.cursor = "pointer";
    li.innerHTML = `<strong>${car.make} ${car.model}</strong>`;
    
    // Add a click listener to the physical card
    li.addEventListener("click", function () {
      selectCar(car);
    });
    
    carList.append(li);
  });
}

// Initial render
renderCars(CARS);

carSearch.addEventListener("input", function () {
  var needle = carSearch.value.trim().toLowerCase();
  
  var results = CARS.filter(function (car) {
    var fullName = (car.make + " " + car.model).toLowerCase();
    return fullName.indexOf(needle) !== -1;
  });
  
  renderCars(results);
});