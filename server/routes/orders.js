// Confirm + Save: POST /api/orders, GET /api/orders/:id, GET /api/orders
const express = require('express');
const productsRepo = require('../repositories/products');   // read chargers, lock one, find overlapping bookings
const ordersRepo = require('../repositories/orders');       // save and read bookings and customers
const { transaction } = require('../db');                    // all-or-nothing saving
const { chargingWindow, calculateOrder } = require('../pricing');                    // charge length and the bill
const { freeSocketsDuring, fitsOpeningHours, openStartTimes } = require('../availability'); // is a socket free?
const { validateOrder, hasErrors, errorBody, toPositiveInt } = require('../validate');      // checks the form fields
const { formatOrder, hoursLabel } = require('../format');                            // DB row → JSON for the page
const { toDb, manila, manilaMidnight, addMinutes, isOnSlotBoundary, manilaClock } = require('../time'); // Manila time helpers
const cfg = require('../config');                                                    // business rules (fees, limits)

// A small group of routes that server/routes/index.js plugs in under /api
const router = express.Router();

// A custom error that also carries an HTTP status code (e.g. 409) and optional extra data.
// Thrown inside the transaction to stop it, then turned into the right response at the bottom.
class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

// When the chosen time is full, finds up to 4 later open start times on the same day
// so the checkout page can say "Open later: 2:00 AM, 2:30 AM…".
async function suggestTimes(product, start, slotCount, now) {
  const dateStr = manila(start).date;            // the booking's date in Manila, e.g. '2026-11-15'
  const dayStart = manilaMidnight(dateStr);      // midnight of that day
  // Bookings of this charger for that whole day (plus enough extra for a charge that runs past midnight)
  const orders = await productsRepo.bookingsOverlapping(product.id, toDb(dayStart), toDb(addMinutes(dayStart, 24 * 60 + slotCount * 30)));
  return openStartTimes({ product, orders, dateStr, slotCount, now })
    .filter((s) => s.start > start)              // only times after the one they picked
    .slice(0, 4)                                 // at most 4 suggestions
    .map((s) => ({ time: manilaClock(s.start), slot_start: s.start.toISOString() })); // e.g. { time: '14:00', slot_start: '...Z' }
}

// POST /api/orders: save a booking (called by checkout.js when the driver clicks "Pay securely")
router.post('/orders', async (req, res) => {
  // 1. Check every field again, even though the page checked too (400 if anything is wrong)
  const { errors, values } = validateOrder(req.body);
  if (hasErrors(errors)) return res.status(400).json(errorBody(errors));

  // 2. The charger they picked must exist (404 if not)
  const product = await productsRepo.getProduct(values.productId);
  if (!product) return res.status(404).json({ error: 'Socket not found' });

  // 3. Time rules (400 if broken)
  const now = new Date();
  const start = values.slotStart;
  // Not in the past (a few minutes' grace, PAST_GRACE_MINUTES in config.js)
  if (start < addMinutes(now, -cfg.PAST_GRACE_MINUTES)) return res.status(400).json({ error: 'Arrival time must be in the future' });
  // Not more than 7 days ahead (BOOKING_DAYS_AHEAD)
  if (start > addMinutes(now, cfg.BOOKING_DAYS_AHEAD * 24 * 60)) {
    return res.status(400).json({ error: `You can book up to ${cfg.BOOKING_DAYS_AHEAD} days ahead` });
  }
  // Must start on :00 or :30
  if (!isOnSlotBoundary(start)) return res.status(400).json({ error: 'Arrival time must be on the hour or half hour' });

  // How long the charge takes (kWh ÷ charger power), rounded up to whole 30-minute slots
  const { minutes, slotCount, slotEnd } = chargingWindow(values.kwh, Number(product.power_kw), start);
  // The whole charge must fit inside the station's opening hours
  if (!fitsOpeningHours(product, start, slotEnd)) {
    return res.status(400).json({
      error: `${product.station_name} is open ${hoursLabel(product)}. A ${minutes}-minute charge starting ${manilaClock(start)} does not fit.`,
    });
  }

  try {
    // Steps 4–7 run in ONE transaction: everything is saved together, or nothing is.
    const order = await transaction(async (conn) => {
      // 4. Lock this charger so two people can't grab the last socket at the same moment,
      //    then count the saved bookings that overlap the chosen window (409 if no socket is free)
      await productsRepo.lockProduct(conn, product.id);
      const overlapping = await productsRepo.bookingsOverlapping(product.id, toDb(start), toDb(slotEnd), conn);
      if (freeSocketsDuring(product.sockets, overlapping, start, slotCount) < 1) {
        const which = product.sockets > 1 ? `All ${product.sockets} sockets are` : 'This socket is';
        throw new HttpError(409, `${which} booked between ${manilaClock(start)} and ${manilaClock(slotEnd)}. Pick another time.`, {
          suggested_times: await suggestTimes(product, start, slotCount, now),
        });
      }

      // 5. Find the customer by email, or create them if this is their first booking
      const createdAt = toDb(now);
      let customer = await ordersRepo.findCustomerForUpdate(conn, values.customerEmail);
      if (!customer) customer = await ordersRepo.insertCustomer(conn, { email: values.customerEmail, name: values.customerName, createdAt });

      // 6. The server computes the bill itself; any total the browser sent is ignored (Challenge 1, test 2)
      const bill = calculateOrder({
        kwh: values.kwh,
        pricePerKwhCents: product.price_per_kwh_cents,
        slotStart: start,
        paymentMethod: values.paymentMethod,
      });
      // Paying with Watt Credits: they must have enough (409 if not)
      if (bill.pointsRedeemed > customer.points_balance) {
        throw new HttpError(409, `Not enough Watt Credits: this booking needs ${bill.pointsRedeemed}, you have ${customer.points_balance}. Choose another payment method.`);
      }

      // 7. Save the booking and update the customer's Watt Credits
      const id = await ordersRepo.insertOrder(conn, {
        productId: product.id,
        customerId: customer.id,
        customerName: values.customerName,
        customerEmail: values.customerEmail,
        paymentMethod: values.paymentMethod,
        kwh: values.kwh,
        slotStart: toDb(start),
        slotEnd: toDb(slotEnd),
        minutes,
        pricePerKwhCents: product.price_per_kwh_cents,
        ...bill,      // copies every amount from the bill (charging, fee, deposit, total, revenue, points)
        createdAt,
      });
      await ordersRepo.updateCustomer(conn, customer.id, {
        name: values.customerName,
        // new balance = old balance − credits spent + credits earned
        pointsBalance: customer.points_balance - bill.pointsRedeemed + bill.pointsEarned,
      });
      // Read the saved booking back (with station name etc.) to send to the page
      return ordersRepo.getOrder(id, conn);
    });

    // 201 Created + the saved booking. checkout.js then opens confirmation.html?id=...
    res.status(201).json(formatOrder(order));
  } catch (err) {
    // Our own errors (409 slot taken / not enough credits) → send that status and message
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, ...err.extra });
    // Two first-time bookings with the same new email at the same moment
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Please try again.' });
    // Anything else is unexpected → the error handler in server.js answers 500 (or 503 if the database is down)
    throw err;
  }
});

// GET /api/orders/:id: one booking, for the confirmation page (404 if the id doesn't exist)
router.get('/orders/:id', async (req, res) => {
  const id = toPositiveInt(req.params.id);                  // e.g. '15' → 15; 'abc' → null
  const order = id && (await ordersRepo.getOrder(id));      // only asks the database if the id is valid
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.status(200).json(formatOrder(order));
});

// GET /api/orders: all bookings for the owner dashboard, newest first.
// Optional ?page= and ?limit= (stretch: pagination). Defaults: page 1, up to 100 bookings.
router.get('/orders', async (req, res) => {
  const page = req.query.page === undefined ? 1 : toPositiveInt(req.query.page);
  const limit = req.query.limit === undefined ? 100 : toPositiveInt(req.query.limit);
  if (!page || !limit || limit > 100) return res.status(400).json({ error: 'page must be 1 or more and limit 1 to 100' });
  // offset = how many to skip, e.g. page 2 with limit 10 skips the first 10
  const rows = await ordersRepo.listOrders({ limit, offset: (page - 1) * limit });
  res.status(200).json(rows.map(formatOrder));
});

// Makes these routes available to server/routes/index.js
module.exports = router;