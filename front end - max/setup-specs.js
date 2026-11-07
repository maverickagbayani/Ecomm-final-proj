var carTitle = document.getElementById("car-title");
var batteryBox = document.getElementById("battery-box");
var speedBox = document.getElementById("speed-box");
var finishBtn = document.getElementById("finish-btn");

function loadCar() {
  var saved = localStorage.getItem("wattspot_vehicle");
  return saved ? JSON.parse(saved) : null; 
}

var currentCar = loadCar();

// Auto-fill the inputs if the car was found in localStorage
if (currentCar) {
  carTitle.textContent = "Confirm specs for " + currentCar.model;
  batteryBox.value = currentCar.battery;
  speedBox.value = currentCar.speed;
} else {
  carTitle.textContent = "No vehicle selected";
}

finishBtn.addEventListener("click", function () {
  // Move to the map!
  window.location.href = "map.html";
});