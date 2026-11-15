require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const api = require('./server/routes');
const app = express();

app.use(express.json());

// The map page (frontend-map) loads config.js. The token stays in .env, never in Git,
// and the map reads live stations from our API instead of the sample stations.json.
app.get('/frontend-map/config.js', (req, res) => {
  res.type('application/javascript').send(
    `const MAPBOX_TOKEN = ${JSON.stringify(process.env.MAPBOX_TOKEN || '')};\nconst API_URL = "/api/stations";\n`
  );
});

app.use(express.static(__dirname));
app.use(express.static('public'));

for (const dir of ['home', 'shop', 'checkout', 'owner']) {
  const full = path.join(__dirname, dir);
  if (fs.existsSync(full)) app.use('/' + dir, express.static(full));
}

const FRONT = path.join(__dirname, 'front end - max');
if (fs.existsSync(FRONT)) {
  app.use('/app', express.static(FRONT));
  app.use('/front end - max', express.static(FRONT));
  app.get('/', (req, res) => res.redirect('/app/index.html'));
} else {
  app.get('/', (req, res) => res.redirect('/shop/stations.html'));
}

// API routes (server/routes/*.js), backed by the MySQL database
app.use('/api', api);

// Errors → JSON with the right status code
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Request body is not valid JSON' });
  if (['ECONNREFUSED', 'ER_ACCESS_DENIED_ERROR', 'ER_BAD_DB_ERROR', 'ETIMEDOUT', 'PROTOCOL_CONNECTION_LOST'].includes(err.code)) {
    console.error('Database unavailable:', err.code);
    return res.status(503).json({ error: 'Database unavailable. Please try again shortly.' });
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on our side. Please try again.' });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
