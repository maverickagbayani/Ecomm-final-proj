# Database schema (MongoDB Atlas, database `wattspot`)

From the Mongoose models in `server/models/`. Money is stored in centavos (₱1 = 100). Times are stored in UTC.

## stations

| Field | Type | Required? | Notes |
|---|---|---|---|
| `_id` | String | Yes | Readable slug, e.g. `up-town-center` |
| `name` | String | Yes | |
| `address` | String | Yes | |
| `area` | String | Yes | e.g. `Diliman` |
| `location.type` | String | No | Always `Point` (default) |
| `location.coordinates` | [Number] | Yes | `[lng, lat]`. 2dsphere index |
| `openHour` | Number | Yes | 0–23, Manila time |
| `closeHour` | Number | Yes | 1–24. `0` to `24` means open 24/7 |
| `description` | String | No | Default `''` |
| `pricePerKwhCents` | Number | Yes | Min 0. `0` means free charging |
| `connectors` | [Connector] | Yes | At least one. Each entry is one physical plug |
| `connectors.connectorId` | String | Yes | e.g. `UPTC-DC1`. Unique across all stations |
| `connectors.label` | String | Yes | e.g. `CCS2 DC #1` |
| `connectors.type` | String | Yes | `CCS2`, `Type2` or `CHAdeMO` |
| `connectors.kw` | Number | Yes | Charger output, min 1 |

## bookings

| Field | Type | Required? | Notes |
|---|---|---|---|
| `_id` | ObjectId | Auto | Used in `/api/bookings/:id` |
| `ref` | String | Yes | Unique. Reference shown to the driver, e.g. `WS-7F3K2Q` |
| `stationId` | String | Yes | References `stations._id` |
| `stationName` | String | Yes | Snapshot at booking time |
| `connectorId` | String | Yes | References `stations.connectors.connectorId` |
| `connectorLabel` | String | Yes | Snapshot |
| `connectorType` | String | Yes | Snapshot |
| `connectorKw` | Number | Yes | Snapshot |
| `customer.name` | String | Yes | |
| `customer.email` | String | Yes | Stored lowercase. Matches `customers.email` |
| `paymentMethod` | String | Yes | `GCash`, `Maya Wallet`, `Card` or `Watt Credits` |
| `vehicle.model` | String | Yes | |
| `vehicle.batteryKwh` | Number | Yes | |
| `vehicle.maxKw` | Number | Yes | |
| `startPct` | Number | Yes | 0–99 |
| `targetPct` | Number | Yes | 1–100 |
| `kwh` | Number | Yes | Estimated energy, min 0.01 |
| `chargeKw` | Number | Yes | Lower of plug kW and car max kW |
| `slotStart` | Date | Yes | |
| `slotEnd` | Date | Yes | |
| `slotCount` | Number | Yes | Number of 30-minute slots, min 1 |
| `chargingMinutes` | Number | Yes | |
| `pricePerKwhCents` | Number | Yes | Snapshot |
| `chargingCents` | Number | Yes | |
| `reservationFeeCents` | Number | Yes | |
| `depositCents` | Number | Yes | Refundable |
| `totalCents` | Number | Yes | |
| `revenueCents` | Number | Yes | Total minus the deposit |
| `pointsEarned` | Number | Yes | Watt Credits earned |
| `pointsRedeemed` | Number | Yes | Watt Credits spent |
| `offPeak` | Boolean | Yes | Start time is off-peak (2× credits) |
| `status` | String | No | `confirmed` (default) or `cancelled` |
| `createdAt` | Date | No | Default now |

## slotholds

| Field | Type | Required? | Notes |
|---|---|---|---|
| `_id` | ObjectId | Auto | |
| `stationId` | String | Yes | References `stations._id` |
| `connectorId` | String | Yes | References `stations.connectors.connectorId`. Unique together with `start` |
| `start` | Date | Yes | Slot start, always on :00 or :30 |
| `date` | String | Yes | Manila date `YYYY-MM-DD`, for reading in Atlas |
| `bookingId` | ObjectId | Yes | References `bookings._id` |

## customers

| Field | Type | Required? | Notes |
|---|---|---|---|
| `_id` | ObjectId | Auto | |
| `email` | String | Yes | Unique, stored lowercase |
| `name` | String | Yes | |
| `points` | Number | Yes | Watt Credits balance. Default 0, min 0 |
| `createdAt` | Date | No | Default now |

## reports

| Field | Type | Required? | Notes |
|---|---|---|---|
| `_id` | ObjectId | Auto | Used in `/api/reports/:id/resolve` |
| `stationId` | String | Yes | References `stations._id` |
| `stationName` | String | Yes | Snapshot |
| `issueType` | String | Yes | `Broken charger`, `Socket blocked`, `Payment problem`, `Station closed` or `Other` |
| `description` | String | Yes | 10–500 characters |
| `reporterName` | String | No | Default `''` |
| `reporterEmail` | String | No | Default `''` |
| `status` | String | No | `open` (default) or `resolved` |
| `createdAt` | Date | No | Default now |
| `resolvedAt` | Date | No | Default `null` |

## Indexes

Besides the default `_id` index on every collection:

| Collection | Index | Type | Why |
|---|---|---|---|
| `stations` | `location` | 2dsphere | Nearby-station search |
| `stations` | `connectors.connectorId` | Unique | No two plugs share an id |
| `bookings` | `ref` | Unique | No two bookings share a reference |
| `bookings` | `createdAt` (descending) | Normal | Newest-first owner list |
| `bookings` | `stationId` + `status` | Normal | Top-station metric |
| `slotholds` | `connectorId` + `start` | **Unique** | Blocks double booking: a second hold on the same plug and slot is rejected, and the API answers 409 |
| `slotholds` | `start` | Normal | Find holds in a time range |
| `customers` | `email` | Unique | One Watt Credits balance per email |
| `reports` | `createdAt` (descending) | Normal | Newest-first owner list |

## How the collections connect

- **Plugs live inside their station.** A plug is an entry in `stations.connectors[]`, not a separate collection. Elsewhere it's referred to by its `connectorId`.
- **A booking points to a station and a plug** (`stationId`, `connectorId`). It also copies the station name, plug details and price at booking time, so later edits to a station don't change past bookings.
- **A booking holds one `slotholds` document for every 30-minute slot it covers.** Each hold points back to the booking (`bookingId`) and to the same station and plug. The booking and its holds are saved in one transaction.
- **A booking links to a customer by email.** `bookings.customer.email` matches `customers.email`. The customer document is created on the first booking, and its `points` change in the same transaction as the booking.
- **A report points to a station** (`stationId`) and copies its name.
