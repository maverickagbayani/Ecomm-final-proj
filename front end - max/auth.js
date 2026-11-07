var emailBox = document.getElementById("email-box");
var passwordBox = document.getElementById("password-box");
var signupBtn = document.getElementById("signup-btn");
var statusLine = document.getElementById("status-line");

function loadUsers() {
  var saved = localStorage.getItem("wattspot_users");
  return saved ? JSON.parse(saved) : {};
}
// The database of users loaded on page load
var users = loadUsers();

function handleSignup() {
  var email = emailBox.value.trim();
  var password = passwordBox.value.trim();

  if (email === "" || password === "") {
    statusLine.textContent = "Please fill in all fields.";
    return; // EXAM RULE: Returning early so the rest of the function doesn't run on blank data
  }

  // Creating the new user object
  users[email] = {
    password: password,
    credits: 0
  };

  localStorage.setItem("wattspot_users", JSON.stringify(users));

  statusLine.textContent = "Account created! Routing to map...";
  
  setTimeout(function () {
    window.location.href = "setup-model.html";
  }, 1000);
}

signupBtn.addEventListener("click", handleSignup);