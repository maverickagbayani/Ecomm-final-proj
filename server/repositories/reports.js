// Incident reports. Only this file saves or changes the reports collection.
const mongoose = require('mongoose');
const { Report } = require('../models');

// Saves a new report as 'open' and returns it.
// Used by: POST /api/reports (the "Report an issue" form)
async function insertReport(r) {
  const doc = await Report.create({
    stationId: r.stationId,
    stationName: r.stationName,
    issueType: r.issueType,
    description: r.description,
    reporterName: r.reporterName,
    reporterEmail: r.reporterEmail,
  });
  return doc.toObject();
}

// One report by its id, or null.
async function getReport(id) {
  if (!mongoose.isValidObjectId(id)) return null;
  return Report.findById(id).lean();
}

// The 100 most recent reports, newest first. Used by: GET /api/reports (owner dashboard)
async function listReports() {
  return Report.find().sort({ createdAt: -1 }).limit(100).lean();
}

// Marks a report as resolved. Returns the updated report, or null if no report has that id.
// Used by: PATCH /api/reports/:id/resolve (the owner's "Mark resolved" button)
async function resolveReport(id) {
  if (!mongoose.isValidObjectId(id)) return null;
  return Report.findByIdAndUpdate(id, { status: 'resolved', resolvedAt: new Date() }, { returnDocument: 'after' }).lean();
}

module.exports = { insertReport, getReport, listReports, resolveReport };
