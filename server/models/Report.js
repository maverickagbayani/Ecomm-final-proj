// reports: incident reports from drivers (broken charger, blocked socket…), GC1 Phase 1.
const mongoose = require('mongoose');
const { ISSUE_TYPES } = require('../config');

const reportSchema = new mongoose.Schema(
  {
    stationId: { type: String, required: true, ref: 'Station' },
    stationName: { type: String, required: true },
    issueType: { type: String, required: true, enum: ISSUE_TYPES },
    description: { type: String, required: true, minlength: 10, maxlength: 500 },
    reporterName: { type: String, default: '' },
    reporterEmail: { type: String, default: '' },
    status: { type: String, enum: ['open', 'resolved'], default: 'open' },
    createdAt: { type: Date, default: Date.now },
    resolvedAt: { type: Date, default: null },
  },
  { versionKey: false }
);

reportSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Report', reportSchema, 'reports');
