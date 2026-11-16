# WattSpot

EV charging-slot booking for Quezon City (ITMGT 45.03, GC2). Drivers browse stations, pick a plug and a time slot, book it, and earn Watt Credits.

## Stack

- **Node.js 24 and Express 5**: one web service that serves both the API (`/api/...`) and the pages.
- **MongoDB Atlas, through Mongoose 9**: stores stations, bookings, slot holds, customers and reports.
- **Plain HTML, CSS and JavaScript with `fetch`**: the front end. It will move to React for the Final Project.

## Run it locally

1. Install Node.js 24.
2. Install the dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env` and set `MONGODB_URI` (plus `MAPBOX_TOKEN` for the map).
4. Seed the stations. This adds 10 Quezon City stations with 28 plugs:
   ```bash
   npm run seed
   ```
   `npm run seed -- --reset` also deletes every booking, slot hold, customer and report.
5. Start the server:
   ```bash
   npm start
   ```
   Then open http://localhost:3000. Use `npm run dev` to restart automatically when files change.

## Environment variables

| Name | What it is |
|---|---|
| `MONGODB_URI` | MongoDB Atlas connection string (required) |
| `MAPBOX_TOKEN` | Mapbox public token for the map page |
| `PORT` | Port to listen on (Render sets this itself) |

## Deploy on Render

One **Web Service** serves both the API and the pages.

1. In MongoDB Atlas, go to **Network Access** and add `0.0.0.0/0`. Render's free tier has no fixed IP address.
2. In Render, choose **New → Web Service** and connect the GitHub repo, branch `main`.
3. Use these settings:

   | Setting | Value |
   |---|---|
   | Language | Node |
   | Build Command | `npm install` |
   | Start Command | `npm start` |
   | Health Check Path | `/api/health` |
   | Instance type | Free |

4. Under **Environment**, add:
   - `MONGODB_URI`: your Atlas connection string, pasted without quotes
   - `NODE_ENV`: `production`
   - `MAPBOX_TOKEN`: optional, for the map view

   Don't set `PORT`; Render sets it, and `server.js` reads `process.env.PORT`.
5. Deploy. Render redeploys automatically whenever something is merged into `main`.

The live site uses the same Atlas database as your local `.env`, so the stations seeded with `npm run seed` are already there. The free tier sleeps when idle, so the first visit after a while can take up to a minute.

## Database (MongoDB collections)

| Collection | Key fields |
|---|---|
| `stations` | `_id` (slug), name, address, area, location (GeoJSON point, 2dsphere index), openHour, closeHour, pricePerKwhCents, connectors[] `{connectorId, label, type, kw}` |
| `bookings` | ref, stationId, connectorId, customer `{name, email}`, vehicle `{model, batteryKwh, maxKw}`, startPct, targetPct, kwh (estimated), chargeKw, paymentMethod, slotStart, slotEnd, slotCount, chargingMinutes, amounts in centavos, pointsEarned, pointsRedeemed, status, createdAt |
| `slotholds` | stationId, connectorId, start, date, bookingId. **Unique index on (connectorId, start)** |
| `customers` | email (unique), name, points |
| `reports` | stationId, stationName, issueType, description, reporter, status, createdAt, resolvedAt |

Each connector is one physical plug. A booking holds one `slotholds` document for every 30-minute slot it covers. The booking and its holds are saved in one transaction. If another booking already holds any of those slots, the unique index rejects the insert and the API answers **409**.

**How a charge is planned** (in `planCharge`, `server/pricing.js`):

- Energy (kWh) = battery capacity × (target % − battery now %)
- Charging speed = the lower of the plug's kW and the car's max kW
- Charge time = energy ÷ speed, rounded up to whole 30-minute slots
- Total = ₱50 reservation fee + energy × station ₱/kWh + ₱100 refundable deposit

For example, a BYD Atto 3 (60.5 kWh, 88 kW max) going from 15% to 85% at SM North EDSA (120 kW, ₱24/kWh) needs 42.35 kWh. At 88 kW that takes 29 minutes, so it holds one slot. The bill is ₱1,016.40 + ₱50 + ₱100 = ₱1,166.40.

All money and charging-time math is in `server/pricing.js`. Every business rule (fees, slot length, points rate) is in `server/config.js`.
