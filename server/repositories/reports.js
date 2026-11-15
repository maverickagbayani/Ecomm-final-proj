// SQL for incident reports. Only this file saves or changes the reports table.
// TODO (Mav): see server/README.md for the tables and columns this file needs.
const { getPool } = require('../db');

// Shared start of every "read reports" query: the report plus its station's name.
const REPORT_SELECT = 'SELECT r.*, s.name AS station_name FROM reports r JOIN stations s ON s.id = r.station_id';

// Saves a new report as 'open', then reads it back (with the station name) to return it.
// Used by: POST /api/reports (the "Report an issue" form)
async function insertReport(r, db = getPool()) {
  const [result] = await db.query(
    `INSERT INTO reports (station_id, issue_type, description, reporter_name, reporter_email, status, created_at)
     VALUES (?, ?, ?, ?, ?, 'open', ?)`,
    [r.stationId, r.issueType, r.description, r.reporterName, r.reporterEmail, r.createdAt]
  );
  return getReport(result.insertId, db);
}

// One report by its id, or null if it doesn't exist.
async function getReport(id, db = getPool()) {
  const [rows] = await db.query(`${REPORT_SELECT} WHERE r.id = ?`, [id]);
  return rows[0] || null;
}

// The 100 most recent reports, newest first.
// Used by: GET /api/reports (owner dashboard)
async function listReports(db = getPool()) {
  const [rows] = await db.query(`${REPORT_SELECT} ORDER BY r.id DESC LIMIT 100`);
  return rows;
}

// Marks a report as resolved and records when.
// Returns true if a report was changed, false if no report has that id (the route then answers 404).
// Used by: PATCH /api/reports/:id/resolve (the owner's "Mark resolved" button)
async function resolveReport(id, resolvedAt, db = getPool()) {
  const [result] = await db.query("UPDATE reports SET status = 'resolved', resolved_at = ? WHERE id = ?", [resolvedAt, id]);
  return result.affectedRows > 0;
}

// Makes these functions available to other files.
// Used by server/routes/reports.js.
module.exports = { insertReport, getReport, listReports, resolveReport };