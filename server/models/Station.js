// stations: one document per charging site, with its plugs (connectors) inside it.
// Each connector is ONE physical plug, so one booking at a time can hold a given slot on it.
const mongoose = require('mongoose');
const { CONNECTORS } = require('../config');

const connectorSchema = new mongoose.Schema(
  {
    connectorId: { type: String, required: true }, // e.g. 'UPTC-DC1': used in URLs and bookings
    label: { type: String, required: true }, // e.g. 'CCS2 DC #1'
    type: { type: String, required: true, enum: Object.keys(CONNECTORS) }, // 'CCS2' | 'Type2' | 'CHAdeMO'
    kw: { type: Number, required: true, min: 1 }, // charger output
  },
  { _id: false }
);

const stationSchema = new mongoose.Schema(
  {
    _id: { type: String }, // readable slug, e.g. 'up-town-center'
    name: { type: String, required: true },
    address: { type: String, required: true },
    area: { type: String, required: true }, // e.g. 'Diliman'
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true }, // [lng, lat]
    },
    openHour: { type: Number, required: true, min: 0, max: 23 }, // Manila time; 0 and 24 = open 24/7
    closeHour: { type: Number, required: true, min: 1, max: 24 },
    description: { type: String, default: '' },
    pricePerKwhCents: { type: Number, required: true, min: 0 }, // 0 = free charging
    connectors: { type: [connectorSchema], validate: (v) => v.length > 0 },
  },
  { versionKey: false }
);

stationSchema.index({ location: '2dsphere' }); // GC1: geospatial "nearby stations"
stationSchema.index({ 'connectors.connectorId': 1 }, { unique: true });

module.exports = mongoose.model('Station', stationSchema, 'stations');
