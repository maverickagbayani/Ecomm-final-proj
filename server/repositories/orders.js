// SQL for customers and orders. Only this file queries those tables.
const { getPool } = require('../db');

// thsi line helps find a cuostomer by email and locks the row until the transaction ends 
// so two bookings by the same customer cant change their Watt Credits at the same time and cause a race condition.
// returns the customer row or null if not found.
async function findCustomerForUpdate(conn, email) {
  const [rows] = await conn.query('SELECT * FROM customers WHERE email = ? FOR UPDATE', [email]);
  return rows[0] || null;
}
// creates a new customer row with 0 Watt Credits and returns the new row (including its id).
async function insertCustomer(conn, { email, name, createdAt }) {
  const [result] = await conn.query(
    'INSERT INTO customers (email, name, points_balance, created_at) VALUES (?, ?, 0, ?)',
    [email, name, createdAt]
  );
  return { id: result.insertId, email, name, points_balance: 0 };
}

// thsi part saves the customer's name and new Watt Credits Balance
// WHERE id = ? focuses on that sole customer so that its the onlyy one changed and not affect others
async function updateCustomer(conn, id, { name, pointsBalance }) {
  await conn.query('UPDATE customers SET name = ?, points_balance = ? WHERE id = ?', [name, pointsBalance, id]);
}

// Saves one booking and returns its new id 
// All amounts were already calculated by the code in pricing.js.
// The values in the list must be in the same order as the columns.

async function insertOrder(conn, o) {
  const [result] = await conn.query(
    `INSERT INTO orders (product_id, customer_id, customer_name, customer_email, payment_method, kwh,
       slot_start, slot_end, charging_minutes, price_per_kwh_cents, charging_cents, reservation_fee_cents,
       deposit_cents, total_cents, revenue_cents, points_earned, points_redeemed, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?)`,
    [
      o.productId, o.customerId, o.customerName, o.customerEmail, o.paymentMethod, o.kwh,
      o.slotStart, o.slotEnd, o.minutes, o.pricePerKwhCents, o.chargingCents, o.reservationFeeCents,
      o.depositCents, o.totalCents, o.revenueCents, o.pointsEarned, o.pointsRedeemed, o.createdAt,
    ]
  );
  return result.insertId;
}

// Shared start of every "read bookings" query: the booking itself plus
// its charger (connector, power), its station (id, name) and the customer's Watt Credits.

const ORDER_SELECT = `
  SELECT o.*, p.connector, p.power_kw, s.id AS station_id, s.name AS station_name, c.points_balance
  FROM orders o
  JOIN products p ON p.id = o.product_id
  JOIN stations s ON s.id = p.station_id
  JOIN customers c ON c.id = o.customer_id`;

// One booking by its id, or null if it doesn't exist (the route then answers 404).
// Used by the confirmation page: GET /api/orders/:id

async function getOrder(id, db = getPool()) {
  const [rows] = await db.query(`${ORDER_SELECT} WHERE o.id = ?`, [id]);
  return rows[0] || null;
}

// Many bookings, newest first. LIMIT/OFFSET return one page at a time.
// tho ios used by the owner dashboard: GET /api/orders

async function listOrders({ limit, offset }, db = getPool()) {
  const [rows] = await db.query(`${ORDER_SELECT} ORDER BY o.id DESC LIMIT ? OFFSET ?`, [limit, offset]);
  return rows;
}

// rhis code makes these functions available to other files.
// Used by server/routes/orders.js to save and read bookings.
module.exports = { findCustomerForUpdate, insertCustomer, updateCustomer, insertOrder, getOrder, listOrders };
