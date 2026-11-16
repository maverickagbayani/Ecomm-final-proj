// One MongoDB connection for the whole server (via Mongoose), plus a transaction helper.
const mongoose = require('mongoose');

// Connects using MONGODB_URI from the environment (.env locally, Render's settings when deployed).
async function connect(uri = process.env.MONGODB_URI) {
  if (!uri) throw new Error('MONGODB_URI is not set. Copy .env.example to .env and fill it in.');
  // Atlas's copied link often has no database name (…mongodb.net/?…), which would mean the "test"
  // database. Use "wattspot" unless the link names one.
  const namesDb = /^mongodb(\+srv)?:\/\/[^/]+\/[^?/]+/.test(uri);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000, ...(namesDb ? {} : { dbName: 'wattspot' }) });
  // Build the indexes declared in server/models (the unique slot index matters for 409s)
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
  return mongoose.connection;
}

// Runs fn(session) inside one transaction: everything is saved together, or nothing is.
// Mongoose retries fn automatically if MongoDB reports a temporary write conflict.
// Used by POST /api/orders: save booking + hold its slots + update the customer's Watt Credits.
function transaction(fn) {
  return mongoose.connection.transaction(fn);
}

module.exports = { connect, transaction };
