# Route table

Every route in `server.js` and `server/routes/*.js`. All are under `/api`.

| Method | Route | Purpose | Query / Body fields | Status codes (and when) |
|---|---|---|---|---|
| GET | `/api/health` | Health check for Render | none | 200 server up and connected to MongoDB · 503 database not connected |
| GET | `/api/stations` | Station list (Browse), one summary per station | Query: `q` (name search, up to 60 chars), `connector` (`CCS2`, `Type2`, `CHAdeMO` or its label), `access` (`free` or `paid`; `pricing` also accepted) | 200 list, an empty list `[]` when nothing matches · 400 unknown connector or access value |
| GET | `/api/stations/:id` | One station with all its plugs and which are free now (Detail) | Path: `id` (station slug, e.g. `up-town-center`) | 200 · 404 unknown station |
| GET | `/api/stations/:id/availability` | Open start times for one plug on one day (revenue feature 1), plus a price preview when the car is given | Query: `connectorId` (required), `date` (`YYYY-MM-DD`, default today, up to 7 days ahead). Optional as a group: `battery_kwh`, `max_kw`, `start_pct`, `target_pct` | 200 · 400 missing `connectorId`, bad or out-of-range date, or bad car/battery input · 404 unknown station, or plug not at this station |
| POST | `/api/bookings/quote` | Server-computed booking preview; nothing is saved | Body: `connector_id` (or `product_id`), `slot_start` (ISO time), `vehicle {model, battery_kwh, max_kw}`, `start_pct`, `target_pct`, `payment_method` (optional, defaults to GCash) | 200 preview with `available` true/false · 400 invalid field, time in the past, more than 7 days ahead, not on :00/:30, or charge doesn't fit opening hours · 404 unknown plug |
| POST | `/api/bookings` | Save a booking (booking + slot holds + Watt Credits in one transaction) | Body: same as the quote, plus `payment_method` (required: `GCash`, `Maya Wallet`, `Card`, `Watt Credits`), `customer_name` (2–80 chars), `customer_email`. Any `total`, `kwh` or price sent is ignored | 201 saved booking · 400 invalid field or time rule broken · 404 unknown plug · 409 slot already taken (with `suggested_times`), same customer already booked it (with `existing_booking_id`), or not enough Watt Credits |
| GET | `/api/bookings/:id` | One booking (Confirmation page) | Path: `id` (MongoDB ObjectId) | 200 · 404 unknown or malformed id |
| GET | `/api/bookings` | All bookings, newest first (owner dashboard) | Query: `page` (default 1), `limit` (default 100, max 100) | 200 list · 400 page below 1 or limit outside 1–100 |
| GET | `/api/customers/:email/points` | A customer's Watt Credits balance (revenue feature 2) | Path: `email` | 200 · 400 malformed email · 404 no bookings with this email |
| GET | `/api/metrics` | The five owner numbers, plus fee revenue and credits issued/redeemed | none | 200 |
| GET | `/api/products` | Every plug as its own row (report form dropdown) | Query: same as `/api/stations` | 200 list · 400 unknown connector or access value |
| GET | `/api/products/:id` | One plug | Path: `id` (plug id, e.g. `UPTC-DC1`) | 200 · 404 unknown plug |
| POST | `/api/reports` | Save an incident report | Body: `station_id` (plug id or station id), `issue_type` (`Broken charger`, `Socket blocked`, `Payment problem`, `Station closed`, `Other`), `description` (10–500 chars), `reporter_name` (optional), `reporter_email` (optional) | 201 saved report · 400 invalid field · 404 unknown station or plug |
| GET | `/api/reports` | The 100 newest reports (owner dashboard) | none | 200 list |
| PATCH | `/api/reports/:id/resolve` | Owner marks a report resolved | Path: `id` (MongoDB ObjectId) | 200 · 404 unknown or malformed id |

## Answers that apply to every route

- **404:** any other `/api/...` path, with a JSON error.
- **400:** the request body isn't valid JSON.
- **503:** the database can't be reached.
- **500:** any other unexpected error.
