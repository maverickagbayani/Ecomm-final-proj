// All /api routes in one router, mounted by server.js. Route table: docs/plan.md, Step 3.
const express = require('express');

const api = express.Router();
api.use(require('./stations'));  // /stations, /stations/:id, /stations/:id/availability (+ /products)
api.use(require('./bookings'));  // /bookings/quote, /bookings, /bookings/:id, /customers/:email/points
api.use(require('./metrics'));   // /metrics
api.use(require('./reports'));   // /reports (incident reports, GC1 Phase 1)

// Unknown API route → JSON 404, never an HTML page
api.use((req, res) => res.status(404).json({ error: `No route for ${req.method} ${req.originalUrl}` }));

module.exports = api;
