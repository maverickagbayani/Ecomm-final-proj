// Seeds the stations collection with Quezon City charging sites.
//
//   npm run seed               → replaces the stations; bookings, customers and reports are kept
//   npm run seed -- --reset    → ALSO deletes every booking, slot hold, customer and report
//
// Uses MONGODB_URI from .env, so running it locally with the Atlas URI seeds the same
// database Render uses.
require('dotenv').config();
const mongoose = require('mongoose');
const { connect } = require('../server/db');
const { Station, Booking, SlotHold, Customer, Report } = require('../server/models');

const peso = (n) => Math.round(n * 100); // ₱ → centavos

// Sample listings for the GC2 demo. Locations are real Quezon City sites; plugs and prices are illustrative.
// Each connector is one physical plug. Type 2 AC: 7–22 kW. CCS2 DC: 50–120 kW.
const STATIONS = [
  {
    _id: 'up-town-center', name: 'UP Town Center', area: 'Diliman',
    address: 'UP Town Center, Katipunan Avenue, Diliman, Quezon City',
    coordinates: [121.0751, 14.6496], openHour: 10, closeHour: 21, price: 26,
    description: 'Basement parking, near the Katipunan entrance.',
    connectors: [['UPTC-DC1', 'CCS2', 60], ['UPTC-DC2', 'CCS2', 60], ['UPTC-AC1', 'Type2', 22], ['UPTC-AC2', 'Type2', 22]],
  },
  {
    _id: 'sm-north-edsa', name: 'SM City North EDSA', area: 'Bagong Pag-asa',
    address: 'SM City North EDSA, North Avenue cor. EDSA, Quezon City',
    coordinates: [121.0305, 14.6565], openHour: 10, closeHour: 22, price: 24,
    description: 'Fast-charging bays at the Annex parking, level 1.',
    connectors: [['SMNE-DC1', 'CCS2', 120], ['SMNE-DC2', 'CCS2', 120], ['SMNE-AC1', 'Type2', 11]],
  },
  {
    _id: 'eastwood-mall', name: 'Eastwood Mall', area: 'Bagumbayan',
    address: 'Eastwood Mall, Eastwood City, Libis, Quezon City',
    coordinates: [121.0803, 14.6097], openHour: 10, closeHour: 22, price: 0,
    description: 'Free charging for mall guests. The reservation fee still applies.',
    connectors: [['EWM-AC1', 'Type2', 22], ['EWM-AC2', 'Type2', 22], ['EWM-DC1', 'CCS2', 50]],
  },
  {
    _id: 'trinoma', name: 'TriNoma', area: 'Bagong Pag-asa',
    address: 'TriNoma, EDSA cor. North Avenue, Quezon City',
    coordinates: [121.0335, 14.6537], openHour: 10, closeHour: 22, price: 25,
    description: 'P2 parking, beside the Landmark entrance.',
    connectors: [['TRN-DC1', 'CCS2', 90], ['TRN-DC2', 'CCS2', 90], ['TRN-AC1', 'Type2', 22]],
  },
  {
    _id: 'gateway-araneta', name: 'Gateway Mall, Araneta City', area: 'Cubao',
    address: 'Gateway Mall, General Aguinaldo Avenue, Araneta City, Cubao, Quezon City',
    coordinates: [121.053, 14.622], openHour: 10, closeHour: 22, price: 24,
    description: 'Gateway 2 parking, level B1.',
    connectors: [['GWA-DC1', 'CCS2', 50], ['GWA-AC1', 'Type2', 7], ['GWA-AC2', 'Type2', 7]],
  },
  {
    _id: 'cloverleaf', name: 'Ayala Malls Cloverleaf', area: 'Balingasa',
    address: 'Ayala Malls Cloverleaf, A. Bonifacio Avenue, Balintawak, Quezon City',
    coordinates: [121.0048, 14.657], openHour: 10, closeHour: 21, price: 27,
    description: 'Open-air parking near the NLEX exit.',
    connectors: [['CLV-DC1', 'CCS2', 60], ['CLV-AC1', 'Type2', 22]],
  },
  {
    _id: 'vertis-north', name: 'Ayala Malls Vertis North', area: 'Bagong Pag-asa',
    address: 'Ayala Malls Vertis North, North Avenue, Quezon City',
    coordinates: [121.037, 14.651], openHour: 10, closeHour: 22, price: 26,
    description: 'Level 2 parking, EV-reserved row.',
    connectors: [['VRT-DC1', 'CCS2', 120], ['VRT-AC1', 'Type2', 22], ['VRT-AC2', 'Type2', 22]],
  },
  {
    _id: 'qc-hall', name: 'Quezon City Hall EV Parking', area: 'Diliman',
    address: 'Quezon City Hall Compound, Elliptical Road, Diliman, Quezon City',
    coordinates: [121.05, 14.6466], openHour: 7, closeHour: 19, price: 0,
    description: 'Free public AC charging in the city hall compound.',
    connectors: [['QCH-AC1', 'Type2', 7], ['QCH-AC2', 'Type2', 7]],
  },
  {
    _id: 'commonwealth-hub', name: 'Commonwealth Ave 24/7 Charging Hub', area: 'Batasan Hills',
    address: 'Commonwealth Avenue, Batasan Hills, Quezon City',
    coordinates: [121.087, 14.689], openHour: 0, closeHour: 24, price: 28,
    description: 'Roadside DC fast charging, open 24/7. Good for trips heading north.',
    connectors: [['CWH-DC1', 'CCS2', 120], ['CWH-DC2', 'CCS2', 120]],
  },
  {
    _id: 'robinsons-magnolia', name: 'Robinsons Magnolia', area: 'New Manila',
    address: 'Robinsons Magnolia, Aurora Boulevard cor. Doña Hemady, New Manila, Quezon City',
    coordinates: [121.0365, 14.6152], openHour: 10, closeHour: 21, price: 25,
    description: 'Basement 1 parking, near the elevators.',
    connectors: [['RMG-AC1', 'Type2', 22], ['RMG-AC2', 'Type2', 22], ['RMG-DC1', 'CCS2', 50]],
  },
];

const TYPE_LABEL = { CCS2: 'CCS2 DC', Type2: 'Type 2 AC' };

// ['UPTC-DC1', 'CCS2', 60] → { connectorId, label: 'CCS2 DC #1', type, kw }
function toDocs() {
  return STATIONS.map(({ coordinates, price, connectors, ...s }) => {
    const countByType = {};
    return {
      ...s,
      location: { type: 'Point', coordinates },
      pricePerKwhCents: peso(price),
      connectors: connectors.map(([connectorId, type, kw]) => {
        countByType[type] = (countByType[type] || 0) + 1;
        return { connectorId, label: `${TYPE_LABEL[type]} #${countByType[type]}`, type, kw };
      }),
    };
  });
}

async function main() {
  const reset = process.argv.includes('--reset');
  await connect();
  console.log(`Connected to database "${mongoose.connection.name}".`);

  if (reset) {
    const [b, h, c, r] = await Promise.all([
      Booking.deleteMany({}), SlotHold.deleteMany({}), Customer.deleteMany({}), Report.deleteMany({}),
    ]);
    console.log(`--reset: deleted ${b.deletedCount} bookings, ${h.deletedCount} slot holds, ${c.deletedCount} customers, ${r.deletedCount} reports.`);
  }

  await Station.deleteMany({});
  const docs = await Station.insertMany(toDocs());
  const plugs = docs.reduce((n, d) => n + d.connectors.length, 0);
  console.log(`Seeded ${docs.length} stations with ${plugs} plugs.`);
}

main()
  .catch((err) => {
    console.error('Seed failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
