// Date helpers. MongoDB stores real Date values (UTC); opening hours are Manila time.
const { UTC_OFFSET_MINUTES, SLOT_MINUTES } = require('./config');

const MINUTE = 60 * 1000;

// Date (or null) → ISO text for the API
const toIso = (date) => (date ? new Date(date).toISOString() : null);

// The Manila calendar date and minute-of-day of a moment
function manila(date) {
  const shifted = new Date(date.getTime() + UTC_OFFSET_MINUTES * MINUTE);
  return {
    date: shifted.toISOString().slice(0, 10),
    hour: shifted.getUTCHours(),
    minuteOfDay: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  };
}

// Midnight (start of day) in Manila for a 'YYYY-MM-DD' date, as a UTC Date
function manilaMidnight(dateStr) {
  return new Date(new Date(`${dateStr}T00:00:00Z`).getTime() - UTC_OFFSET_MINUTES * MINUTE);
}

const addMinutes = (date, minutes) => new Date(date.getTime() + minutes * MINUTE);

const isOnSlotBoundary = (date) => date.getUTCSeconds() === 0 && date.getUTCMilliseconds() === 0 && date.getUTCMinutes() % SLOT_MINUTES === 0;

function isValidDateString(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(`${s}T00:00:00Z`).getTime());
}

// '14:30' in Manila for a Date
function manilaClock(date) {
  const m = manila(date).minuteOfDay;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

module.exports = { MINUTE, toIso, manila, manilaMidnight, addMinutes, isOnSlotBoundary, isValidDateString, manilaClock };
