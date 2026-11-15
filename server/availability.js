// Revenue feature 1: availability filtering.
// Whether a socket is free is always computed from the bookings saved in the database.
// Nothing here talks to the database itself: it receives bookings and does the math.
const { SLOT_MINUTES, PAST_GRACE_MINUTES } = require('./config');       // 30-minute slots; 5-minute grace
const { fromDb, manila, manilaMidnight, addMinutes } = require('./time'); // Manila time helpers

// True if the station is open 24/7 (stored as opening at 0 and closing at 24)
const is24h = (station) => station.open_hour === 0 && station.close_hour === 24;

// The exact opening and closing moments for the Manila day that `date` falls on.
// e.g. a station open 10–22 → { open: 10:00 AM that day, close: 10:00 PM that day }
// (Returned as UTC Dates, so they can be compared directly with booking times.)
function openingHours(station, date) {
  const midnight = manilaMidnight(manila(date).date);
  return { open: addMinutes(midnight, station.open_hour * 60), close: addMinutes(midnight, station.close_hour * 60) };
}

// True if a charge from `start` to `end` happens entirely while the station is open.
// e.g. a station open 10 AM–10 PM: 9:00 PM–9:30 PM fits; 9:30 PM–10:30 PM doesn't.
function fitsOpeningHours(station, start, end) {
  if (is24h(station)) return true;
  const { open, close } = openingHours(station, start);
  return start >= open && end <= close;
}

// Splits a time window into 30-minute slots and counts, for each slot,
// how many saved bookings overlap it. Returns a list like [1, 2, 2, 0].
function busyPerSlot(orders, windowStart, slotCount) {
  const busy = new Array(slotCount).fill(0);            // start every slot at 0 bookings
  for (const o of orders) {
    const s = fromDb(o.slot_start).getTime();            // booking start, in milliseconds
    const e = fromDb(o.slot_end).getTime();              // booking end
    for (let k = 0; k < slotCount; k++) {
      const a = windowStart.getTime() + k * SLOT_MINUTES * 60000;  // this slot's start
      const b = a + SLOT_MINUTES * 60000;                          // this slot's end
      // Overlap rule: the booking starts before the slot ends AND ends after the slot starts
      if (s < b && e > a) busy[k] += 1;
    }
  }
  return busy;
}

// How many sockets stay free for the WHOLE window: total sockets minus the busiest slot.
// e.g. 2 sockets, busy per slot [1, 2, 0] → busiest is 2 → 2 − 2 = 0 free → can't book.
function freeSocketsDuring(sockets, orders, start, slotCount) {
  return sockets - Math.max(0, ...busyPerSlot(orders, start, slotCount));
}

// Every start time on a date where a charge of `slotCount` slots fits:
// inside opening hours, not in the past, and with at least one socket free the whole time.
// This is the list shown in the station page's "Open start times" dropdown.
function openStartTimes({ product, orders, dateStr, slotCount, now }) {
  const dayStart = manilaMidnight(dateStr);
  const earliest = addMinutes(now, -PAST_GRACE_MINUTES);   // a slot that started under 5 minutes ago still counts
  const results = [];
  // Try every start time that day: 00:00, 00:30, 01:00 … 23:30 (48 tries)
  for (let k = 0; k < (24 * 60) / SLOT_MINUTES; k++) {
    const start = addMinutes(dayStart, k * SLOT_MINUTES);
    const end = addMinutes(start, slotCount * SLOT_MINUTES);
    // Skip times already past, or charges that would run outside opening hours
    if (start < earliest || !fitsOpeningHours(product, start, end)) continue;
    // Keep it only if at least one socket is free for the whole charge
    const free = freeSocketsDuring(product.sockets, orders, start, slotCount);
    if (free > 0) results.push({ start, end, freeSockets: free });
  }
  return results;
}

// Makes these functions available to other files.
// Used by routes/products.js (open times), routes/orders.js (booking check),
// routes/metrics.js (slots almost full) and format.js (24/7 label).
module.exports = { is24h, openingHours, fitsOpeningHours, freeSocketsDuring, openStartTimes, busyPerSlot };