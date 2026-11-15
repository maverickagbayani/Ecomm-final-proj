// Date helpers. The database stores UTC as 'YYYY-MM-DD HH:MM:SS'; opening hours are Manila time.
const { UTC_OFFSET_MINUTES, SLOT_MINUTES } = require('./config');

const MINUTE = 60 * 1000;

// Date → 'YYYY-MM-DD HH:MM:SS' (UTC) for MySQL
const toDb = (date) => date.toISOString().slice(0, 19).replace('T', ' ');

// 'YYYY-MM-DD HH:MM:SS' (UTC) from MySQL → Date
const fromDb = (text) => new Date(text.replace(' ', 'T') + 'Z');

// Date → ISO text for the API, or null
const toIso = (text) => (text ? fromDb(text).toISOString() : null);

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

module.exports = { MINUTE, toDb, fromDb, toIso, manila, manilaMidnight, addMinutes, isOnSlotBoundary, isValidDateString, manilaClock };
