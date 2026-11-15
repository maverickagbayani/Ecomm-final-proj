// One MySQL connection pool for the whole server, plus a transaction helper.
const mysql = require('mysql2/promise');

// Reads the connection settings from environment variables (.env locally, the host's settings when deployed).
function connectionOptions() {
   // Settings used no matter how we connect
  const common = {
    dateStrings: true, // DATETIME comes back as 'YYYY-MM-DD HH:MM:SS' text, not a Date in the server's time zone
    timezone: 'Z', // we store UTC
    // Only if DB_SSL=true in .env: use an encrypted connection 
    ...(process.env.DB_SSL === 'true' && { ssl: { rejectUnauthorized: true } }),
  };
  
  // Option A: one connection link, e.g. mysql://user:password@host:3306/wattspot
  if (process.env.DATABASE_URL) return { uri: process.env.DATABASE_URL, ...common };
  // Option B: separate settings. Each falls back to a default (after ||) if it isn't in .env.
  return {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'wattspot',
    ...common,
  };
}

// The pool: a set of up to 10 open connections that every request shares.
// Opening a new connection for each request is slow; a pool reuses them.

let pool = null;
function getPool() {
  // Created the first time it's needed, then reused for the life of the server
  if (!pool) pool = mysql.createPool({ ...connectionOptions(), waitForConnections: true, connectionLimit: 10 });
  return pool;
}

// Runs fn(conn) inside one transaction: everything is saved together, or nothing is.
// Used by POST /api/orders: lock the charger, check sockets, save customer, save booking, update credits.
async function transaction(fn) {
  const conn = await getPool().getConnection(); // borrow a connection
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback(); // any step failed (or a 409 was thrown) and undo everything
    throw err; // pass the error on so the route can answer properly
  } finally {
    conn.release();// always give the connection back to the pool
  }
}// Makes these available to other files:
//   getPool           - used by every file in repositories/
//   transaction       - used by routes/orders.js
//   connectionOptions - used by db/setup.js

module.exports = { getPool, transaction, connectionOptions };
