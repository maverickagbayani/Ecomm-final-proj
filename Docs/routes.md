# Route Table

WattSpot back end: Node.js + Express 5, data stored in MongoDB (Mongoose).
Base URL when running locally: `http://localhost:3000`
Every API route sends and receives JSON. Routes live in `server/routes/`.

## Summary

| # | Method | Route | What it takes | What it returns | Status codes |
|---|--------|-------|---------------|-----------------|--------------|
| 1 | GET | `/api/stations` | Query (all optional): `q`, `connector`, `access` | One summary per station | 200, 400 |
| 2 | GET | `/api/stations/:id` | Station id in the URL | One station with all its plugs | 200, 404 |
| 3 | GET | `/api/stations/:id/availability` | Query: `connectorId` (required), `date`, and the optional car fields `battery_kwh`, `max_kw`, `start_pct`, `target_pct` | Open start times for one plug on one day | 200, 400, 404 |
| 4 | GET | `/api/products` | Query (all optional): `q`, `connector`, `access` | Every plug as its own row | 200, 400 |
| 5 | GET | `/api/products/:id` | Plug id in the URL | One plug | 200, 404 |
| 6 | POST | `/api/bookings/quote` | JSON body: the booking without the customer | The price and time preview. Nothing is saved. | 200, 400, 404 |
| 7 | POST | `/api/bookings` | JSON body: plug, start time, car, battery %, payment method, customer | The saved booking with its bill | 201, 400, 404, 409 |
| 8 | GET | `/api/bookings/:id` | Booking id in the URL | One booking | 200, 404 |
| 9 | GET | `/api/bookings` | Query (optional): `page`, `limit` | Bookings, newest first | 200, 400 |
| 10 | GET | `/api/customers/:email/points` | Email in the URL | The customer's Watt Credits balance | 200, 400, 404 |
| 11 | GET | `/api/metrics` | Nothing | Owner dashboard numbers | 200 |
| 12 | POST | `/api/reports` | JSON body: `station_id`, `issue_type`, `description`, optional `reporter_name`, `reporter_email` | The saved report | 201, 400, 404 |
| 13 | GET | `/api/reports` | Nothing | The 100 newest reports | 200 |
| 14 | PATCH | `/api/reports/:id/resolve` | Report id in the URL | The updated report | 200, 404 |

Also in `server.js`:

| Method | Route | What it does | Status codes |
|--------|-------|--------------|--------------|
| GET | `/api/health` | Health check for Render. Says whether the server is connected to MongoDB. | 200 `{"status":"ok"}`, 503 `{"status":"database unavailable"}` |

Status codes that can come from **any** API route:

| Code | When |
|------|------|
| 400 | The request body is not valid JSON |
| 404 | Unknown `/api/...` route (`{"error": "No route for GET /api/nope"}`) |
| 500 | Unexpected server error |
| 503 | MongoDB cannot be reached |

Every error uses the same shape: `{ "error": "message" }`. Form errors (400) also include `"fields": { "field_name": "message" }`.

**Ids:** stations use a readable id such as `up-town-center`. Plugs (connectors) use ids such as `UPTC-DC1`. Bookings and reports use MongoDB ids (24 characters). An id that does not exist, or is not the right shape, gives a 404.

---

## 1. GET /api/stations

The station list (Browse) and the map. One summary per station.

| Query | Meaning |
|-------|---------|
| `q` | Search text, matched against station name, address or area (max 60 characters) |
| `connector` | `CCS2`, `Type2` or `CHAdeMO` (also accepts the label, such as `Type 2 AC`) |
| `access` | `free` or `paid` (`pricing` is accepted as an older name) |

- **200**: array of stations. No matches is still `200` with `[]`.
- **400**: `connector` or `access` is not a valid value.

```json
{
  "id": "up-town-center", "name": "UP Town Center", "address": "UP Town Center, Katipunan Avenue, Diliman, Quezon City",
  "location": { "type": "Point", "coordinates": [121.0751, 14.6496] },
  "freeSockets": 3, "totalSockets": 4,
  "connectors": ["CCS2", "Type2"], "pricing": "PAID", "pricePerKwh": 26,
  "hours": "Daily 10:00 AM to 9:00 PM", "products": ["UPTC-DC1", "UPTC-DC2", "UPTC-AC1", "UPTC-AC2"]
}
```

`coordinates` is `[longitude, latitude]`. Each plug is one socket, so `freeSockets` is the number of plugs not in use right now. It is calculated from slot holds, not stored.

## 2. GET /api/stations/:id

One station and all its plugs, for the station page.

- **200**: the same fields as above, plus `area`, `description`, `open_now` and `plugs` (an array of plugs, fastest first, each in the shape shown under route 5).
- **404**: `{"error": "Station not found"}`.

## 3. GET /api/stations/:id/availability

Start times that are still open for one plug on one day. Used by the "Open start times" picker.

| Query | Default | Rule |
|-------|---------|------|
| `connectorId` | none | **Required.** A plug at this station, such as `UPTC-DC1`. |
| `date` | today | `YYYY-MM-DD`, from today up to 6 days later (Manila time) |
| `battery_kwh`, `max_kw`, `start_pct`, `target_pct` | none | Optional as a group. If any one is sent, they are all checked. They decide how long a free window is needed and add a price preview. Rules are the same as route 7. |

- **200**:

```json
{
  "station_id": "up-town-center", "connector_id": "UPTC-DC1", "date": "2026-11-17",
  "slot_count": 2, "kwh": 36, "charge_kw": 60, "charging_minutes": 36,
  "estimate": { "charging": 936, "reservation_fee": 50, "deposit": 100, "total": 1086 },
  "starts": [
    { "time": "10:00", "slot_start": "2026-11-17T02:00:00.000Z", "slot_end": "2026-11-17T03:00:00.000Z",
      "off_peak": false, "points_earned": 18 }
  ]
}
```

Without the car fields, `slot_count` is 1, `kwh`, `charge_kw`, `charging_minutes` and `estimate` are `null`, and `points_earned` is left out.

- **400**: `connectorId` is missing, `date` is invalid or out of range, or a car field is invalid.
- **404**: the station does not exist, or the plug is not at this station.

## 4. GET /api/products

Every plug as its own row (used by the "Report an issue" dropdown). Takes the same filters as route 1.

- **200**: array of plugs. No matches is `[]`.
- **400**: `connector` or `access` is not a valid value.

## 5. GET /api/products/:id

One plug.

- **200**:

```json
{
  "id": "UPTC-DC1", "station_id": "up-town-center",
  "name": "UP Town Center · CCS2 DC #1", "station_name": "UP Town Center",
  "address": "UP Town Center, Katipunan Avenue, Diliman, Quezon City", "area": "Diliman",
  "lat": 14.6496, "lng": 121.0751,
  "connector": "CCS2 DC", "connector_code": "CCS2", "power_kw": 60,
  "hours": "Daily 10:00 AM to 9:00 PM", "open_now": true, "description": "...",
  "price_per_kwh": 26, "sockets": 1, "stock": 1
}
```

`stock` is `1` if the plug is free right now and `0` if it is in use.

- **404**: `{"error": "Product not found"}`.

## 6. POST /api/bookings/quote

The server's preview of a booking, before the customer form. Nothing is saved. The cart and checkout pages show these numbers, so the price always comes from the server.

Body: the same as route 7, but without `customer_name` and `customer_email`, and `payment_method` is optional (it defaults to GCash).

- **200**: the plan, the bill and whether the slot is still free:

```json
{
  "connector_id": "UPTC-DC1", "product_id": "UPTC-DC1", "station_id": "up-town-center",
  "socket": "UP Town Center · CCS2 DC #1",
  "vehicle": { "model": "My EV", "battery_kwh": 60, "max_kw": 88 },
  "start_pct": 20, "target_pct": 80, "kwh": 36, "charge_kw": 60,
  "charging_minutes": 36, "slot_count": 2,
  "slot_start": "2026-11-17T04:00:00.000Z", "slot_end": "2026-11-17T05:00:00.000Z",
  "payment_method": "GCash",
  "breakdown": { "price_per_kwh": 26, "charging": 936, "reservation_fee": 50, "deposit": 100 },
  "total": 1086, "points_earned": 18, "points_redeemed": 0, "off_peak": false,
  "available": true
}
```

- **400**: a field is missing or invalid, or a time rule is broken (same messages as route 7).
- **404**: `{"error": "Socket not found"}`.

## 7. POST /api/bookings

Saves a booking. Called by the checkout page when the driver clicks "Pay securely". The server works out the energy, time and bill itself and ignores any `kwh`, `total` or price sent by the browser.

Body:

```json
{
  "connector_id": "UPTC-DC1",
  "slot_start": "2026-11-17T04:00:00.000Z",
  "payment_method": "GCash",
  "vehicle": { "model": "Hyundai Ioniq 5", "battery_kwh": 60, "max_kw": 88 },
  "start_pct": 20,
  "target_pct": 80,
  "customer_name": "Ana Cruz",
  "customer_email": "ana@example.com"
}
```

| Field | Rule |
|-------|------|
| `connector_id` | A plug id, such as `UPTC-DC1`. `product_id` is accepted as the older name. |
| `slot_start` | Date and time (ISO text) |
| `payment_method` | `GCash`, `Maya Wallet`, `Card` or `Watt Credits` |
| `vehicle.model` | Optional, up to 60 characters. Defaults to `My EV`. |
| `vehicle.battery_kwh` | 10 to 200 |
| `vehicle.max_kw` | 3 to 400 (the car's top charging speed) |
| `start_pct` | Whole number, 0 to 99 (battery now) |
| `target_pct` | Whole number, 1 to 100, higher than `start_pct` |
| `customer_name` | 2 to 80 characters |
| `customer_email` | Valid email, up to 120 characters |

Time rules: not in the past (5 minutes of grace), at most 7 days ahead, on the hour or half hour, and the whole charge must fit inside the station's opening hours.

How the server works it out: energy = battery size × (target − start) %. Speed = the lower of the plug's kW and the car's `max_kw`. Time = energy ÷ speed, rounded up to whole 30-minute slots.

- **201**: the saved booking:

```json
{
  "id": "6730a1b2c3d4e5f607182930", "ref": "WS-7F3K2Q",
  "connector_id": "UPTC-DC1", "product_id": "UPTC-DC1", "station_id": "up-town-center",
  "customer_name": "Ana Cruz", "customer_email": "ana@example.com",
  "payment_method": "GCash", "socket": "UP Town Center · CCS2 DC #1",
  "connector": "CCS2 DC", "power_kw": 60,
  "vehicle": { "model": "Hyundai Ioniq 5", "battery_kwh": 60, "max_kw": 88 },
  "start_pct": 20, "target_pct": 80, "kwh": 36, "charge_kw": 60,
  "slot_start": "2026-11-17T04:00:00.000Z", "slot_end": "2026-11-17T05:00:00.000Z", "slot_count": 2,
  "socket_frees_at": "2026-11-17T05:10:00.000Z", "charging_minutes": 36,
  "breakdown": { "price_per_kwh": 26, "charging": 936, "reservation_fee": 50, "deposit": 100 },
  "total": 1086, "revenue": 986,
  "points_earned": 18, "points_redeemed": 0, "points_balance": 18,
  "off_peak": false, "status": "confirmed", "createdAt": "2026-11-16T08:00:00.000Z"
}
```

- **400**: a field is missing or invalid (`error` is the first message, `fields` lists all of them), or a time rule is broken:
  - `Arrival time must be in the future`
  - `You can book up to 7 days ahead`
  - `Arrival time must be on the hour or half hour`
  - `<Station> is open <hours>. A <n>-minute charge starting <time> does not fit.`
- **404**: `{"error": "Socket not found"}`: no plug has that `connector_id`.
- **409**: the booking conflicts with something already saved:
  - A slot in the window is already held by another booking. The body includes `suggested_times`, up to 4 later open times that day: `[{ "time": "14:00", "slot_start": "..." }]`. This is MongoDB rejecting a second hold on the same slot (see schema.md).
  - The same customer already booked this exact slot (a second tab, or a retry): `You already booked this slot (WS-7F3K2Q).`, with `existing_booking_id`.
  - Paying with Watt Credits but the customer does not have enough.
  - Two first-time bookings with the same new email at the same moment (`Please try again.`).

The booking, its slot holds and the customer's Watt Credits are saved in one transaction: either all of it is saved or none of it is.

## 8. GET /api/bookings/:id

One booking, for the confirmation page.

- **200**: one booking (same shape as the 201 above).
- **404**: `{"error": "Booking not found"}`. Also returned if `:id` is not a valid id.

## 9. GET /api/bookings

All bookings, newest first. Used by the owner dashboard.

| Query | Default | Rule |
|-------|---------|------|
| `page` | 1 | 1 or more |
| `limit` | 100 | 1 to 100 |

- **200**: array of bookings.
- **400**: `page must be 1 or more and limit 1 to 100`.

## 10. GET /api/customers/:email/points

A customer's Watt Credits balance.

- **200**: `{ "email": "ana@example.com", "name": "Ana Cruz", "points": 18 }`
- **400**: `Enter a valid email address.`
- **404**: `No bookings found for this email`. Customers are created on their first booking.

## 11. GET /api/metrics

The owner dashboard numbers, calculated from saved bookings.

- **200**:

```json
{
  "total_orders": 12,
  "total_revenue": 5400,
  "average_order_value": 450,
  "top_selling_station": { "id": "up-town-center", "name": "UP Town Center", "orders": 7, "kwh": 140.5 },
  "low_stock": [
    { "id": "UPTC-DC1", "name": "UP Town Center · CCS2 DC #1", "date": "2026-11-16", "available_slots": 4, "total_slots": 22 }
  ],
  "reservation_fee_revenue": 600,
  "watt_credits_issued": 80,
  "watt_credits_redeemed": 10
}
```

`total_revenue` leaves out the refundable ₱100 deposits. `top_selling_station` is `null` when there are no bookings. `low_stock` lists plugs that are 80% or more booked today.

## 12. POST /api/reports

Saves an incident report ("Report an issue" form). New reports start as `open`.

```json
{
  "station_id": "UPTC-DC1",
  "issue_type": "Broken charger",
  "description": "The plug will not lock in place.",
  "reporter_name": "Ana Cruz",
  "reporter_email": "ana@example.com"
}
```

| Field | Rule |
|-------|------|
| `station_id` | Required. The form sends a plug id; a station id is also accepted (plug ids are checked first). |
| `issue_type` | `Broken charger`, `Socket blocked`, `Payment problem`, `Station closed` or `Other` |
| `description` | 10 to 500 characters |
| `reporter_name` | Optional, up to 80 characters |
| `reporter_email` | Optional, must be a valid email if given |

- **201**: the saved report:

```json
{
  "id": "6730a1b2c3d4e5f607182931", "station_id": "up-town-center", "station": "UP Town Center",
  "issue_type": "Broken charger", "description": "The plug will not lock in place.",
  "reporter_name": "Ana Cruz", "reporter_email": "ana@example.com",
  "status": "open", "createdAt": "2026-11-16T08:00:00.000Z", "resolvedAt": null
}
```

- **400**: a field is missing or invalid.
- **404**: `{"error": "Station not found"}`.

## 13. GET /api/reports

The 100 newest reports, newest first (owner dashboard).

- **200**: array of reports (same shape as above).

## 14. PATCH /api/reports/:id/resolve

The owner's "Mark resolved" button. It changes part of an existing report, so it uses PATCH, not POST.

- **200**: the updated report, with `"status": "resolved"` and `resolvedAt` filled in.
- **404**: `{"error": "Report not found"}`. Also returned if `:id` is not a valid id.

---

## Other routes (not part of the API)

| Method | Route | What it does |
|--------|-------|--------------|
| GET | `/` | Redirects to `/app/index.html` |
| GET | `/frontend-map/config.js` | Sends the Mapbox token (from `MAPBOX_TOKEN` in `.env`) and `API_URL = "/api/stations"` to the map page |
| GET | `/app/...`, `/shop/...`, `/checkout/...`, `/owner/...`, `/frontend-map/...` | Static pages from the matching folders |

## Business rules the routes use

These are all in `server/config.js`, so changing one is a one-line edit.

| Rule | Value |
|------|-------|
| Booking slots | 30 minutes, starting on the hour or half hour |
| Book ahead | Up to 7 days |
| Past grace | A slot that started less than 5 minutes ago can still be booked |
| Socket frees up | 10 minutes after the booked window ends (`socket_frees_at`) |
| Reservation fee | ₱50 (counts as revenue) |
| Deposit | ₱100 (refundable, not counted as revenue) |
| Battery size | 10 to 200 kWh |
| Car's top charging speed | 3 to 400 kW |
| Watt Credits | 1 credit per ₱50 of charging cost, doubled for charging between 10 PM and 6 AM. Paying with credits spends 1 credit per ₱1 of the total and earns none. |
| Slots almost full | 80% or more of today's slots booked |
