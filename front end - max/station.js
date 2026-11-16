// Station page (Detail + Select): one station, its plugs, and a booking panel.
// URL: station.html?id=<station id>[&plug=<plug id>]
//
// Fetch:     GET /api/stations/:id                       → station + plugs (free now or in use)
//            GET /api/stations/:id/availability?connectorId&date&battery_kwh&max_kw&start_pct&target_pct
//                → open start times + the server's plan (kWh, speed, minutes) and price preview
// Transform: pick a plug, list the open times, build the estimate
// Render:    plug cards, time dropdown, estimate; "Continue" saves the selection and opens the cart.
var params = new URLSearchParams(location.search);
var stationId = params.get("id");
var state = {
  station: null, plug: null, date: "", times: null,
  // The car and charge. Filled from the saved car (setup pages) or the last selection.
  charge: { model: "", battery_kwh: "", max_kw: "", start_pct: 20, target_pct: 80 },
};

// Reads the car and charge fields. Returns { values } or { error } (the server checks the same rules).
function readCharge() {
  var v = {
    model: $("car-model").value.trim(),
    battery_kwh: Number($("car-battery").value),
    max_kw: Number($("car-kw").value),
    start_pct: Number($("start-pct").value),
    target_pct: Number($("target-pct").value),
  };
  if (!$("car-battery").value || !(v.battery_kwh >= 10 && v.battery_kwh <= 200)) return { error: "Enter your battery size: 10 to 200 kWh." };
  if (!$("car-kw").value || !(v.max_kw >= 3 && v.max_kw <= 400)) return { error: "Enter your car's max charging speed: 3 to 400 kW." };
  if (!Number.isInteger(v.start_pct) || v.start_pct < 0 || v.start_pct > 99) return { error: "Battery now must be a whole number from 0 to 99%." };
  if (!Number.isInteger(v.target_pct) || v.target_pct < 1 || v.target_pct > 100) return { error: "Charge-to must be a whole number from 1 to 100%." };
  if (v.target_pct <= v.start_pct) return { error: "Charge-to % must be higher than your battery now." };
  return { values: v };
}

function chargeQuery(v) {
  return "&battery_kwh=" + encodeURIComponent(v.battery_kwh) + "&max_kw=" + encodeURIComponent(v.max_kw) +
    "&start_pct=" + encodeURIComponent(v.start_pct) + "&target_pct=" + encodeURIComponent(v.target_pct);
}
var page = $("page");

function infoRow(label, value) {
  return '<div class="info-row"><span>' + esc(label) + "</span><b>" + esc(value) + "</b></div>";
}

// The next 7 Manila dates as <option>s: Today, Tomorrow, then "Thu, Nov 19"
function dateOptions() {
  var html = "";
  for (var i = 0; i < 7; i++) {
    var d = new Date(Date.now() + i * 86400000);
    var value = manilaDate.format(d);
    var label = i === 0 ? "Today" : i === 1 ? "Tomorrow" : manilaDay.format(d);
    html += '<option value="' + value + '">' + label + "</option>";
  }
  return html;
}

function renderPage() {
  var s = state.station;
  var c = state.charge;
  document.title = s.name + " · WattSpot";
  page.innerHTML =
    "<h1>" + esc(s.name) + "</h1>" +
    '<p class="page-sub">' + esc(s.address) + "</p>" +
    '<div class="detail-grid">' +
      '<section class="glass-card">' +
        "<h2>Station details</h2>" +
        infoRow("Area", s.area) +
        infoRow("Hours", s.hours) +
        infoRow("Right now", s.open_now ? "Open" : "Closed") +
        infoRow("Rate", priceText(s.pricePerKwh)) +
        infoRow("Free plugs now", s.freeSockets + " of " + s.totalSockets) +
        (s.description ? '<p class="note" style="margin-top: 12px;">' + esc(s.description) + "</p>" : "") +
        '<h3 style="margin: 20px 0 0;">Choose a plug</h3>' +
        '<div class="plug-grid" id="plugs" role="group" aria-label="Plugs"></div>' +
        '<button id="report-btn" type="button" class="primary-btn link-btn" style="margin-top: 20px;">Report an issue</button>' +
      "</section>" +
      '<section class="glass-card book-card">' +
        "<h2>Book a slot</h2>" +
        '<p class="muted" id="sel-plug"></p>' +
        '<fieldset class="field-group"><legend>Your car</legend>' +
          (c.battery_kwh ? "" : '<p class="note" style="margin: 0 0 10px;">Enter your car\'s specs, or <a href="setup-model.html">pick your car</a> to fill them in.</p>') +
          '<label for="car-model">Model (optional)</label>' +
          '<input id="car-model" type="text" maxlength="60" placeholder="e.g. BYD Atto 3" value="' + esc(c.model) + '" />' +
          '<div class="field-row">' +
            '<div><label for="car-battery">Battery (kWh)</label>' +
            '<input id="car-battery" type="number" inputmode="decimal" min="10" max="200" step="0.1" value="' + esc(c.battery_kwh) + '" /></div>' +
            '<div><label for="car-kw">Max charging (kW)</label>' +
            '<input id="car-kw" type="number" inputmode="decimal" min="3" max="400" step="1" value="' + esc(c.max_kw) + '" /></div>' +
          "</div>" +
        "</fieldset>" +
        '<div class="field-row">' +
          '<div><label for="start-pct">Battery now (%)</label>' +
          '<input id="start-pct" type="number" inputmode="numeric" min="0" max="99" step="1" value="' + esc(c.start_pct) + '" /></div>' +
          '<div><label for="target-pct">Charge to (%)</label>' +
          '<input id="target-pct" type="number" inputmode="numeric" min="1" max="100" step="1" value="' + esc(c.target_pct) + '" /></div>' +
        "</div>" +
        '<label for="date">Day</label>' +
        '<select id="date">' + dateOptions() + "</select>" +
        '<label for="time">Open start times</label>' +
        '<select id="time" disabled><option>Loading…</option></select>' +
        '<div id="estimate" class="estimate" aria-live="polite"></div>' +
        '<div id="book-msg" role="alert"></div>' +
        '<button id="continue" type="button" class="primary-btn" disabled>Continue to cart</button>' +
        '<p class="note">Only open times are shown. Final price is confirmed by our server at checkout.</p>' +
      "</section>" +
    "</div>";

  if (state.date) $("date").value = state.date;
  if (!$("date").value) $("date").selectedIndex = 0; // a saved day that has already passed
  renderPlugs();
  var onChargeInput = debounce(loadTimes, 400);
  ["car-battery", "car-kw", "start-pct", "target-pct"].forEach(function (id) { $(id).addEventListener("input", onChargeInput); });
  $("date").addEventListener("change", function () { state.date = $("date").value; loadTimes(); });
  $("time").addEventListener("change", renderEstimate);
  $("continue").addEventListener("click", goToCart);
  $("report-btn").addEventListener("click", openReport);
}

function renderPlugs() {
  $("plugs").innerHTML = state.station.plugs.map(function (p) {
    var label = p.name.split(" · ").pop(); // 'CCS2 DC #1'
    return '<button type="button" class="plug-card" data-plug="' + esc(p.id) + '" aria-pressed="' + (p.id === state.plug.id) + '">' +
      "<strong>" + esc(label) + "</strong>" +
      "<small>" + esc(p.power_kw) + " kW · " + (p.stock > 0 ? "Free now" : "In use now") + "</small>" +
      "</button>";
  }).join("");
  $("sel-plug").textContent = state.plug.name.split(" · ").pop() + " · up to " + state.plug.power_kw + " kW";
  document.querySelectorAll(".plug-card").forEach(function (b) {
    b.addEventListener("click", function () {
      state.plug = state.station.plugs.find(function (p) { return p.id === b.dataset.plug; });
      renderPlugs();
      loadTimes();
    });
  });
}

function showBookError(text) {
  $("book-msg").innerHTML = text ? '<div class="error-msg">' + esc(text) + "</div>" : "";
}

// Fetch the open start times for the chosen plug, day, car and battery %
var timesRequest = 0;
async function loadTimes() {
  var mine = ++timesRequest;
  var select = $("time");
  state.times = null;
  showBookError("");
  select.disabled = true;
  $("estimate").innerHTML = "";
  $("continue").disabled = true;
  var read = readCharge();
  if (read.error) {
    select.innerHTML = "<option>Enter your car and battery % first</option>";
    if ($("car-battery").value || $("car-kw").value) showBookError(read.error); // don't nag before they start typing
    return;
  }
  state.charge = read.values;
  select.innerHTML = "<option>Loading open times…</option>";
  var url = "/api/stations/" + encodeURIComponent(state.station.id) + "/availability?connectorId=" + encodeURIComponent(state.plug.id) +
    "&date=" + encodeURIComponent($("date").value) + chargeQuery(read.values);
  try {
    var data = await getJSON(url);
    if (mine !== timesRequest) return;
    state.times = data;
    if (!data.starts.length) {
      select.innerHTML = "<option>No open times this day</option>";
      showBookError("This plug has no open " + data.charging_minutes + "-minute window on that day. Try another day or plug.");
      return;
    }
    select.innerHTML = data.starts.map(function (s) {
      return '<option value="' + esc(s.slot_start) + '">' + clock12(s.time) + (s.off_peak ? " · 2× Watt Credits" : "") + "</option>";
    }).join("");
    var saved = cart.get();
    if (saved && saved.product_id === state.plug.id && data.starts.some(function (s) { return s.slot_start === saved.slot_start; })) select.value = saved.slot_start;
    select.disabled = false;
    $("continue").disabled = false;
    renderEstimate();
  } catch (e) {
    if (mine !== timesRequest) return;
    select.innerHTML = "<option>Could not load times</option>";
    showBookError(e.message || "Could not load open times. Try again.");
  }
}

// Render the server's preview for the chosen time
function renderEstimate() {
  var d = state.times;
  if (!d || !d.starts.length) return;
  var start = d.starts.find(function (s) { return s.slot_start === $("time").value; }) || d.starts[0];
  var endTime = new Date(start.slot_end).toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" });
  var c = state.charge;
  var limitedBy = c.max_kw < state.plug.power_kw ? " (your car's limit)" : c.max_kw > state.plug.power_kw ? " (this plug's limit)" : "";
  $("estimate").innerHTML =
    infoRow("Energy needed", d.kwh + " kWh (" + c.start_pct + "% → " + c.target_pct + "%)") +
    infoRow("Charging speed", d.charge_kw + " kW" + limitedBy) +
    infoRow("Charging time", "about " + d.charging_minutes + " min (holds " + d.slot_count + " × 30-min slot" + (d.slot_count > 1 ? "s" : "") + ")") +
    infoRow("Plug is yours until", endTime) +
    infoRow("Charging cost", peso(d.estimate.charging)) +
    infoRow("Reservation fee", peso(d.estimate.reservation_fee)) +
    infoRow("Refundable overstay deposit", peso(d.estimate.deposit)) +
    infoRow("Watt Credits you'd earn", "+" + start.points_earned) +
    infoRow("Estimated total", peso(d.estimate.total));
}

function goToCart() {
  var slot = $("time").value;
  var read = readCharge();
  if (read.error) return showBookError(read.error);
  if (!slot || !state.times) return showBookError("Choose an open start time.");
  var v = read.values;
  cart.set({
    product_id: state.plug.id,
    slot_start: slot,
    vehicle: { model: v.model || "My EV", battery_kwh: v.battery_kwh, max_kw: v.max_kw },
    start_pct: v.start_pct,
    target_pct: v.target_pct,
  });
  // Remember the car for next time (same format the setup pages save)
  var saved = savedVehicle() || {};
  var label = v.model || [saved.make, saved.model].filter(Boolean).join(" ");
  try {
    localStorage.setItem("wattspot_vehicle", JSON.stringify({ make: "", model: label || "My EV", battery: v.battery_kwh, speed: v.max_kw }));
  } catch (e) { /* storage blocked */ }
  window.location.href = "/shop/cart.html";
}

// ---------- Report an issue ----------
var modal = $("report-modal");
function openReport() {
  $("report-station").textContent = state.station.name;
  $("report-msg").innerHTML = "";
  modal.classList.remove("hidden");
  $("issue-type").focus();
}
function closeReport() { modal.classList.add("hidden"); }
document.querySelectorAll(".close-modal").forEach(function (b) { b.addEventListener("click", closeReport); });
document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeReport(); });

$("report-form").addEventListener("submit", async function (e) {
  e.preventDefault();
  var msg = $("report-msg"), btn = $("report-send");
  var desc = $("issue-desc").value.trim(), email = $("issue-email").value.trim();
  if (desc.length < 10) { msg.innerHTML = '<div class="error-msg">Describe the problem in at least 10 characters.</div>'; return; }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { msg.innerHTML = '<div class="error-msg">Enter a valid email or leave it blank.</div>'; return; }
  btn.disabled = true; btn.textContent = "Sending…";
  try {
    var res = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ station_id: state.station.id, issue_type: $("issue-type").value, description: desc, reporter_name: $("issue-name").value.trim(), reporter_email: email }),
    });
    var data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not send the report");
    $("report-form").reset();
    msg.innerHTML = '<div class="ok-msg">Thank you. The station owner can now see your report.</div>';
  } catch (err) {
    msg.innerHTML = '<div class="error-msg">' + esc(err.message) + "</div>";
  } finally {
    btn.disabled = false; btn.textContent = "Send report";
  }
});

// ---------- Start ----------
(async function init() {
  if (!stationId) {
    page.innerHTML = '<h1>No station chosen</h1><p><a class="primary-btn" style="display: inline-block; width: auto; text-decoration: none;" href="directory.html">Browse stations</a></p>';
    return;
  }
  try {
    state.station = await getJSON("/api/stations/" + encodeURIComponent(stationId));
  } catch (e) {
    page.innerHTML = "<h1>" + (e.status === 404 ? "Station not found" : "Could not load this station") + "</h1>" +
      '<p class="page-sub">' + (e.status === 404 ? "It may have been removed." : "Check your connection and refresh.") + "</p>" +
      '<a class="primary-btn" style="display: inline-block; width: auto; text-decoration: none;" href="directory.html">Back to stations</a>';
    return;
  }
  var plugs = state.station.plugs;
  var saved = cart.get();
  var wanted = params.get("plug") || (saved && saved.product_id);
  state.plug = plugs.find(function (p) { return p.id === wanted; }) || plugs.find(function (p) { return p.stock > 0; }) || plugs[0];
  // Car: from the last selection if there is one, else from the saved car
  var car = savedVehicle();
  if (saved && saved.vehicle) {
    state.charge = {
      model: saved.vehicle.model, battery_kwh: saved.vehicle.battery_kwh, max_kw: saved.vehicle.max_kw,
      start_pct: saved.start_pct, target_pct: saved.target_pct,
    };
  } else if (car) {
    state.charge.model = [car.make, car.model].filter(Boolean).join(" ");
    state.charge.battery_kwh = car.battery;
    state.charge.max_kw = car.speed;
  }
  if (saved && saved.product_id === state.plug.id) state.date = manilaDate.format(new Date(saved.slot_start));
  renderPage();
  loadTimes();
})();
