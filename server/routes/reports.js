// Incident reports: POST /api/reports, GET /api/reports, PATCH /api/reports/:id/resolve
const express = require('express');
const reportsRepo = require('../repositories/reports');      // save, list and resolve reports
const productsRepo = require('../repositories/products');    // look up which station a plug belongs to
const { validateReport, hasErrors, errorBody } = require('../validate'); // checks the form fields
const { formatReport } = require('../format');                // DB document → JSON for the pages

// A small group of routes that server/routes/index.js plugs in under /api
const router = express.Router();

// POST /api/reports: save a new report (from the "Report an issue" form, owner/report.js)
router.post('/reports', async (req, res) => {
  // 1. Check the fields: station, issue type, description of 10–500 characters, valid email if given (400 if wrong)
  const { errors, values } = validateReport(req.body);
  if (hasErrors(errors)) return res.status(400).json(errorBody(errors));

  // 2. Work out which station the report is about.
  // The report form's dropdown lists plugs (from /api/products), so it sends a plug id like 'UPTC-DC1'.
  // We look up that plug's station. If it isn't a plug id, we accept it as a station id instead.
  let station = null;
  const product = await productsRepo.getProduct(values.stationId);
  if (product) station = { id: product.station_id, name: product.station_name };
  else {
    const s = await productsRepo.getStation(values.stationId);
    if (s) station = { id: s._id, name: s.name };
  }
  if (!station) return res.status(404).json({ error: 'Station not found' });

  // 3. Save it (status starts as 'open') and send it back: 201 Created
  const report = await reportsRepo.insertReport({ ...values, stationId: station.id, stationName: station.name });
  res.status(201).json(formatReport(report));
});

// GET /api/reports: the 100 most recent reports, newest first (owner dashboard)
router.get('/reports', async (req, res) => {
  res.status(200).json((await reportsRepo.listReports()).map(formatReport));
});

// PATCH /api/reports/:id/resolve: the owner's "Mark resolved" button.
router.patch('/reports/:id/resolve', async (req, res) => {
  const report = await reportsRepo.resolveReport(req.params.id);
  if (!report) return res.status(404).json({ error: 'Report not found' });
  res.status(200).json(formatReport(report));
});

module.exports = router;
