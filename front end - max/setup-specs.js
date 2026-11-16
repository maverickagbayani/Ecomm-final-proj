var carTitle = document.getElementById("car-title");
var batteryBox = document.getElementById("battery-box");
var speedBox = document.getElementById("speed-box");
var msg = document.getElementById("specs-msg");

function loadCar() {
  try { return JSON.parse(localStorage.getItem("wattspot_vehicle")); } catch (e) { return null; }
}

var currentCar = loadCar();

// Auto-fill the inputs from the car picked on step 1
if (currentCar) {
  carTitle.textContent = "Confirm specs for " + ((currentCar.make ? currentCar.make + " " : "") + currentCar.model);
  batteryBox.value = currentCar.battery;
  speedBox.value = currentCar.speed;
} else {
  window.location.replace("setup-model.html"); // nothing picked yet
}

document.getElementById("specs-form").addEventListener("submit", function (e) {
  e.preventDefault();
  var battery = Number(batteryBox.value), speed = Number(speedBox.value);
  if (!(battery >= 10 && battery <= 200)) { msg.innerHTML = '<div class="error-msg">Battery capacity must be between 10 and 200 kWh.</div>'; return; }
  if (!(speed >= 3 && speed <= 400)) { msg.innerHTML = '<div class="error-msg">Max charging speed must be between 3 and 400 kW.</div>'; return; }
  currentCar.battery = battery;
  currentCar.speed = speed;
  try { localStorage.setItem("wattspot_vehicle", JSON.stringify(currentCar)); } catch (err) { /* storage blocked */ }
  window.location.href = "directory.html";
});
