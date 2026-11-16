// Confirm + Save: POST /api/bookings/quote, POST /api/bookings, GET /api/bookings/:id, GET /api/bookings,
// GET /api/customers/:email/points
const express = require('express');
const productsRepo = require('../repositories/products');   // read plugs and their held slots
const ordersRepo = require('../repositories/orders');       // save and read bookings, slot holds and customers
const { transaction } = require('../db');                    // all-or-nothing saving
const { planCharge } = require('../pricing');                // energy, speed, time window and the bill
const { fitsOpeningHours, openStartTimes } = require('../availability');             // opening hours; open times
const { validateSelection, validateOrder, hasErrors, errorBody, toPositiveInt, EMAIL } = require('../validate'); // checks the form fields
const { formatOrder, hoursLabel, pesos } = require('../format');                     // DB document → JSON for the page
const { manila, manilaMidnight, addMinutes, isOnSlotBoundary, manilaClock } = require('../time'); // Manila time helpers
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

// True if a MongoDB duplicate-key error came from the slotholds (connectorId, start) unique index.
// (insertMany reports it as a bulk-write error, so the index name is read from the message.)
const isSlotTaken = (err) => err && err.code === 11000 && /slotholds/.test(String(err.message));

// When the chosen time is taken, finds up to 4 later open start times on the same day
// so the checkout page can say "Open later: 14:00, 14:30…".
async function suggestTimes(product, start, slotCount, now) {
  const dateStr = manila(start).date;
  const dayStart = manilaMidnight(dateStr);
  const orders = await productsRepo.bookingsOverlapping(product.id, dayStart, addMinutes(dayStart, 24 * 60 + slotCount * cfg.SLOT_MINUTES));
  return openStartTimes({ product, orders, dateStr, slotCount, now })
    .filter((s) => s.start > start)
    .slice(0, 4)
    .map((s) => ({ time: manilaClock(s.start), slot_start: s.start.toISOString() }));
}

// Shared by the quote and the booking: finds the plug, checks the time rules,
// and plans the charge (kWh from battery %, speed, slots, bill).
// Returns { fail: { status, body } } or { product, plan, start, now }.
async function prepare(values) {
  // The plug they picked must exist (404 if not)
  const product = await productsRepo.getProduct(values.productId);
  if (!product) return { fail: { status: 404, body: { error: 'Socket not found' } } };

  // Time rules (400 if broken)
  const now = new Date();
  const start = values.slotStart;
  const bad = (error) => ({ fail: { status: 400, body: { error } } });
  if (start < addMinutes(now, -cfg.PAST_GRACE_MINUTES)) return bad('Arrival time must be in the future');
  if (start > addMinutes(now, cfg.BOOKING_DAYS_AHEAD * 24 * 60)) return bad(`You can book up to ${cfg.BOOKING_DAYS_AHEAD} days ahead`);
  if (!isOnSlotBoundary(start)) return bad('Arrival time must be on the hour or half hour');

  // The server plans the charge itself; any kWh or total the browser sent is ignored (Challenge 1, test 2)
  const plan = planCharge({
    batteryKwh: values.batteryKwh,
    maxKw: values.maxKw,
    startPct: values.startPct,
    targetPct: values.targetPct,
    chargerKw: product.power_kw,
    pricePerKwhCents: product.price_per_kwh_cents,
    slotStart: start,
    paymentMethod: values.paymentMethod,
  });
  if (!fitsOpeningHours(product, start, plan.slotEnd)) {
    return bad(`${product.station_name} is open ${hoursLabel(product)}. A ${plan.minutes}-minute charge starting ${manilaClock(start)} does not fit.`);
  }
  return { product, plan, start, now };
}

// POST /api/bookings/quote: the server's preview of a booking, before the customer form.
// Same body as POST /api/bookings minus the customer. Nothing is saved.
// 200 with the plan and whether the slot is still free · 400 invalid · 404 unknown plug.
// Used by the cart and checkout pages, so the price they show comes from pricing.js.
router.post('/bookings/quote', async (req, res) => {
  const { errors, values } = validateSelection(req.body, { requirePayment: false });
  if (hasErrors(errors)) return res.status(400).json(errorBody(errors));
  const prep = await prepare(values);
  if (prep.fail) return res.status(prep.fail.status).json(prep.fail.body);

  const { product, plan, start } = prep;
  const held = await productsRepo.bookingsOverlapping(product.id, start, plan.slotEnd);
  const b = plan.bill;
  res.status(200).json({
    connector_id: product.id,
    product_id: product.id,
    station_id: product.station_id,
    socket: `${product.station_name} · ${product.label}`,
    vehicle: { model: values.model, battery_kwh: values.batteryKwh, max_kw: values.maxKw },
    start_pct: values.startPct,
    target_pct: values.targetPct,
    kwh: plan.kwh,
    charge_kw: plan.speedKw,
    charging_minutes: plan.minutes,
    slot_count: plan.slotCount,
    slot_start: start.toISOString(),
    slot_end: plan.slotEnd.toISOString(),
    payment_method: values.paymentMethod,
    breakdown: {
      price_per_kwh: pesos(product.price_per_kwh_cents),
      charging: pesos(b.chargingCents),
      reservation_fee: pesos(b.reservationFeeCents),
      deposit: pesos(b.depositCents),
    },
    total: pesos(b.totalCents),
    points_earned: b.pointsEarned,
    points_redeemed: b.pointsRedeemed,
    off_peak: b.offPeak,
    available: held.length === 0,
  });
});

// POST /api/bookings: save a booking (called by checkout.js when the driver clicks "Pay securely")
router.post('/bookings', async (req, res) => {
  // 1. Check every field again, even though the page checked too (400 if anything is wrong)
  const { errors, values } = validateOrder(req.body);
  if (hasErrors(errors)) return res.status(400).json(errorBody(errors));

  // 2–4. Plug exists (404), time rules (400), and the server's own plan and bill
  const prep = await prepare(values);
  if (prep.fail) return res.status(prep.fail.status).json(prep.fail.body);
  const { product, plan, start, now } = prep;
  const bill = plan.bill;

  try {
    // Steps 5–7 run in ONE transaction: everything is saved together, or nothing is.
    const order = await transaction(async (session) => {
      // 5. Save the booking and hold each of its 30-minute slots on this plug.
      //    A slot someone else already holds makes MongoDB reject the insert (→ 409 below).
      const booking = await ordersRepo.insertBookingWithHolds(session, {
        stationId: product.station_id,
        stationName: product.station_name,
        connectorId: product.id,
        connectorLabel: product.label,
        connectorType: product.connector,
        connectorKw: product.power_kw,
        customer: { name: values.customerName, email: values.customerEmail },
        paymentMethod: values.paymentMethod,
        vehicle: { model: values.model, batteryKwh: values.batteryKwh, maxKw: values.maxKw },
        startPct: values.startPct,
        targetPct: values.targetPct,
        kwh: plan.kwh,
        chargeKw: plan.speedKw,
        slotStart: start,
        slotEnd: plan.slotEnd,
        slotCount: plan.slotCount,
        chargingMinutes: plan.minutes,
        pricePerKwhCents: product.price_per_kwh_cents,
        chargingCents: bill.chargingCents,
        reservationFeeCents: bill.reservationFeeCents,
        depositCents: bill.depositCents,
        totalCents: bill.totalCents,
        revenueCents: bill.revenueCents,
        pointsEarned: bill.pointsEarned,
        pointsRedeemed: bill.pointsRedeemed,
        offPeak: bill.offPeak,
        createdAt: now,
      });

      // 6. Update Watt Credits (creates the customer on their first booking).
      //    Paying with Watt Credits: they must have enough (409 if not).
      const ok = await ordersRepo.applyPoints(session, {
        email: values.customerEmail,
        name: values.customerName,
        earned: bill.pointsEarned,
        redeemed: bill.pointsRedeemed,
      });
      if (!ok) {
        const customer = await ordersRepo.findCustomer(values.customerEmail, session);
        const have = customer ? customer.points : 0;
        throw new HttpError(409, `Not enough Watt Credits: this booking needs ${bill.pointsRedeemed}, you have ${have}. Choose another payment method.`);
      }

      // 7. Read the saved booking back to send to the page
      return ordersRepo.getOrder(booking._id, session);
    });

    // 201 Created + the saved booking. checkout.js then opens confirmation.html?id=...
    res.status(201).json(formatOrder(order));
  } catch (err) {
    // Our own errors (not enough credits) → send that status and message
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, ...err.extra });
    // A slot in the window is already held by another booking → 409 with later open times
    if (isSlotTaken(err)) {
      // Same customer, same plug, same start: they already have this booking (second tab or retry)
      const mine = await ordersRepo.findSameBooking({ email: values.customerEmail, connectorId: product.id, slotStart: start });
      if (mine) {
        return res.status(409).json({
          error: `You already booked this slot (${mine.ref}).`,
          existing_booking_id: String(mine._id),
        });
      }
      return res.status(409).json({
        error: `This socket is booked between ${manilaClock(start)} and ${manilaClock(plan.slotEnd)}. Pick another time.`,
        suggested_times: await suggestTimes(product, start, plan.slotCount, now),
      });
    }
    // Two first-time bookings with the same new email at the same moment
    if (err.code === 11000) return res.status(409).json({ error: 'Please try again.' });
    // Anything else is unexpected → the error handler in server.js answers 500 (or 503 if the database is down)
    throw err;
  }
});

// GET /api/bookings/:id: one booking, for the confirmation page (404 if the id doesn't exist)
router.get('/bookings/:id', async (req, res) => {
  const order = await ordersRepo.getOrder(req.params.id);
  if (!order) return res.status(404).json({ error: 'Booking not found' });
  res.status(200).json(formatOrder(order));
});

// GET /api/bookings: all bookings for the owner dashboard, newest first.
// Optional ?page= and ?limit= (stretch: pagination). Defaults: page 1, up to 100 bookings.
router.get('/bookings', async (req, res) => {
  const page = req.query.page === undefined ? 1 : toPositiveInt(req.query.page);
  const limit = req.query.limit === undefined ? 100 : toPositiveInt(req.query.limit);
  if (!page || !limit || limit > 100) return res.status(400).json({ error: 'page must be 1 or more and limit 1 to 100' });
  const rows = await ordersRepo.listOrders({ limit, offset: (page - 1) * limit });
  res.status(200).json(rows.map(formatOrder));
});

// GET /api/customers/:email/points: a customer's Watt Credits balance (revenue feature 2).
// 400 if the email is malformed, 404 if nobody has booked with it yet.
router.get('/customers/:email/points', async (req, res) => {
  const email = String(req.params.email).trim().toLowerCase();
  if (!EMAIL.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  const customer = await ordersRepo.customerPoints(email);
  if (!customer) return res.status(404).json({ error: 'No bookings found for this email' });
  res.status(200).json({ email: customer.email, name: customer.name, points: customer.points });
});

module.exports = router;
