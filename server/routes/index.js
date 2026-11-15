// All /api routes in one router, mounted by server.js
const express = require('express');

const api = express.Router();
api.use(require('./products'));
api.use(require('./orders'));
api.use(require('./metrics'));
api.use(require('./reports'));

// Unknown API route → JSON 404, never an HTML page
api.use((req, res) => res.status(404).json({ error: `No route for ${req.method} ${req.originalUrl}` }));

module.exports = api;
