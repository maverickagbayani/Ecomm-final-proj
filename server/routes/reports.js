// Incident reports: POST /api/reports, GET /api/reports, PATCH /api/reports/:id/resolve
const express = require('express');
const reportsRepo = require('../repositories/reports');      // save, list and resolve reports
const productsRepo = require('../repositories/products');    // look up which station a charger belongs to
const { validateReport, hasErrors, errorBody, toPositiveInt } = require('../validate'); // checks the form fields
const { formatReport } = require('../format');                // DB row → JSON for the pages
const { toDb } = require('../time');                          // JS date → MySQL date format

// A small group of routes that server/routes/index.js plugs in under /api
const router = express.Router();

// POST /api/reports: save a new report (from the "Report an issue" form, owner/report.js)
router.post('/reports', async (req, res) => {
  // 1. Check the fields: station, issue type, description of 10–500 characters, valid email if given (400 if wrong)
  const { errors, values } = validateReport(req.body);
  if (hasErrors(errors)) return res.status(400).json(errorBody(errors));

  // 2. Work out which station the report is about.
  // The report form's dropdown lists chargers (from /api/products), so it sends a charger (product) id.
  // We look up that charger's station. If it isn't a charger id, we accept it as a station id instead.
  // (Product ids are checked first: if a number is both, it's treated as a product id.)
  let stationId = null;
  const product = await productsRepo.getProduct(values.stationId);
  if (product) stationId = product.station_id;
  else if (await productsRepo.getStation(values.stationId)) stationId = values.stationId;
  if (!stationId) return res.status(404).json({ error: 'Station not found' });

  // 3. Save it (status starts as 'open') and send it back: 201 Created
  const report = await reportsRepo.insertReport({ ...values, stationId, createdAt: toDb(new Date()) });
  res.status(201).json(formatReport(report));
});

// GET /api/reports: the 100 most recent reports, newest first (owner dashboard)
router.get('/reports', async (req, res) => {
  res.status(200).json((await reportsRepo.listReports()).map(formatReport));
});

// PATCH /api/reports/:id/resolve: the owner's "Mark resolved" button.
// PATCH (not POST) because it changes part of an existing report rather than creating a new one.
router.patch('/reports/:id/resolve', async (req, res) => {
  const id = toPositiveInt(req.params.id);
  // 404 if the id isn't a valid number, or no report has that id (resolveReport returns false)
  if (!id || !(await reportsRepo.resolveReport(id, toDb(new Date())))) {
    return res.status(404).json({ error: 'Report not found' });
  }
  // Send back the updated report, now with status 'resolved'
  res.status(200).json(formatReport(await reportsRepo.getReport(id)));
});

// Makes these routes available to server/routes/index.js
module.exports = router;