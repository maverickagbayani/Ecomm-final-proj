require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const mongoose = require('mongoose');
const { connect } = require('./server/db');
const api = require('./server/routes');

const app = express();
app.use(express.json());

// The map page (frontend-map) loads config.js. The Mapbox token stays in .env, never in Git,
// and the map reads live stations from our API.
app.get('/frontend-map/config.js', (req, res) => {
  res.type('application/javascript').send(
    `const MAPBOX_TOKEN = ${JSON.stringify(process.env.MAPBOX_TOKEN || '')};\nconst API_URL = "/api/stations";\n`
  );
});

// Only these folders are public. Never serve the project root: it holds .env files and server code.
const PUBLIC_DIRS = { '/app': 'front end - max', '/shop': 'shop', '/checkout': 'checkout', '/owner': 'owner', '/frontend-map': 'frontend-map' };
for (const [url, dir] of Object.entries(PUBLIC_DIRS)) {
  const full = path.join(__dirname, dir);
  if (fs.existsSync(full)) app.use(url, express.static(full));
}
app.get('/', (req, res) => res.redirect('/app/index.html'));
// Browsers ask for /favicon.ico on every page; without this each page logs a 404 in the Console.
app.get('/favicon.ico', (req, res) => res.type('image/svg+xml').sendFile(path.join(__dirname, 'front end - max', 'favicon.svg')));

// Health check for Render (Settings → Health Check Path: /api/health).
// 200 when the server is up and connected to MongoDB, 503 otherwise.
app.get('/api/health', (req, res) => {
  const up = mongoose.connection.readyState === 1;
  res.status(up ? 200 : 503).json({ status: up ? 'ok' : 'database unavailable' });
});

// API routes (server/routes/*.js), backed by MongoDB
app.use('/api', api);

// Errors → JSON with the right status code
const DB_DOWN = ['MongoServerSelectionError', 'MongoNetworkError', 'MongoNetworkTimeoutError', 'MongoNotConnectedError'];
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Request body is not valid JSON' });
  if (DB_DOWN.includes(err.name)) {
    console.error('Database unavailable:', err.message);
    return res.status(503).json({ error: 'Database unavailable. Please try again shortly.' });
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on our side. Please try again.' });
});

// Render (and most hosts) set PORT; 3000 is only the local default.
const PORT = process.env.PORT || 3000;

connect()
  .then(() => app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT} (listening on port ${PORT})`)))
  .catch((err) => {
    console.error('Could not connect to MongoDB:', err.message);
    process.exit(1);
  });
