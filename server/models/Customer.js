// customers: one document per email address, holding their Watt Credits (loyalty points).
// Created automatically on a customer's first booking.
const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    name: { type: String, required: true },
    points: { type: Number, required: true, default: 0, min: 0 },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

module.exports = mongoose.model('Customer', customerSchema, 'customers');
