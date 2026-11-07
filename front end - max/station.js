var checkinBtn = document.getElementById("checkin-btn");
var reportBtn = document.getElementById("report-btn");
var checkinModal = document.getElementById("checkin-modal");
var reportModal = document.getElementById("report-modal");
var targetChargeInput = document.getElementById("target-charge");
var estimatedTime = document.getElementById("estimated-time");
var closeButtons = document.querySelectorAll(".close-modal");

// Opens a modal by removing the "hidden" class
function openModal(modalElement) {
  modalElement.classList.remove("hidden");
}

// Closes a modal by adding the "hidden" class
function closeModal(modalElement) {
  modalElement.classList.add("hidden");
}

// Event Listeners for opening
checkinBtn.addEventListener("click", function () {
  openModal(checkinModal);
});

reportBtn.addEventListener("click", function () {
  openModal(reportModal);
});

// Event Listeners for closing (using a loop for multiple close buttons)
closeButtons.forEach(function (btn) {
  btn.addEventListener("click", function (event) {
    // Finds the closest parent with the class 'modal-overlay' and hides it
    var parentModal = event.target.closest(".modal-overlay");
    closeModal(parentModal);
  });
});

// Calculate live battery time
targetChargeInput.addEventListener("input", function() {
  var target = parseInt(targetChargeInput.value, 10);
  
  if (isNaN(target) || target <= 20) {
    estimatedTime.textContent = "0 min";
  } else {
    // Mock formula: 1 min per percentage point above 20%
    var time = (target - 20);
    estimatedTime.textContent = time + " min";
  }
});