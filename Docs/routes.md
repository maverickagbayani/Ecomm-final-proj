# Route Table

WattSpot back end: Node.js + Express, data stored in MySQL.
Base URL when running locally: `http://localhost:3000`
Every API route sends and receives JSON. Routes live in `server/routes/`.

## Summary

| # | Method | Route | What it takes | What it returns | Status codes |
|---|--------|-------|---------------|-----------------|--------------|
| 1 | GET | `/api/products` | Query (all optional): `q`, `connector`, `pricing` | List of chargers (each with its station details) | 200, 400 |
| 2 | GET | `/api/products/:id` | Charger id in the URL | One charger | 200, 404 |
| 3 | GET | `/api/products/:id/availability` | Query (optional): `date`, `kwh` | Open start times for that day | 200, 400, 404 |
| 4 | GET | `/api/stations` | Query (all optional): `q`, `connector`, `pricing` | One summary per station, for the map | 200, 400 |
| 5 | POST | `/api/orders` | JSON body: `customer_name`, `customer_email`, `product_id`, `kwh`, `payment_method`, `slot_start` | The saved booking with its bill | 201, 400, 404, 409 |
| 6 | GET | `/api/orders/:id` | Booking id in the URL | One booking | 200, 404 |
| 7 | GET | `/api/orders` | Query (optional): `page`, `limit` | Bookings, newest first | 200, 400 |
| 8 | GET | `/api/metrics` | Nothing | Owner dashboard numbers | 200 |
| 9 | POST | `/api/reports` | JSON body: `station_id`, `issue_type`, `description`, optional `reporter_name`, `reporter_email` | The saved report | 201, 400, 404 |
| 10 | GET | `/api/reports` | Nothing | The 100 newest reports | 200 |
| 11 | PATCH | `/api/reports/:id/resolve` | Report id in the URL | The updated report | 200, 404 |

Status codes that can come from **any** route:

| Code | When |
|------|------|
| 400 | The request body is not valid JSON |
| 404 | Unknown `/api/...` route (`{"error": "No route for GET /api/nope"}`) |
| 500 | Unexpected server error |
| 503 | The database cannot be reached |

Every error uses the same shape: `{ "error": "message" }`. Form errors (400) also include `"fields": { "field_name": "message" }`.

---

## 1. GET /api/products

The station list (Browse). Used by the stations page, home page and directory.

| Query | Meaning |
|-------|---------|
| `q` | Search text, matched against station name or address (max 60 characters) |
| `connector` | `CCS2`, `Type2` or `CHAdeMO` (also accepts the label, such as `Type 2 AC`) |
| `pricing` | `FREE` or `PAID` |

- **200**: array of chargers. No matches is still `200` with `[]`.
- **400**: `connector` or `pricing` is not a valid value.

Each charger:

```json
{
  "id": 1, "station_id": 1,
  "name": "UP Town Center · CCS2 DC", "station_name": "UP Town Center",
  "address": "Katipunan Ave, Quezon City", "lat": 14.6537, "lng": 121.0733,
  "connector": "CCS2 DC", "connector_code": "CCS2", "power_kw": 50,
  "hours": "Daily 10:00 AM to 9:00 PM", "open_now": true, "description": "...",
  "price_per_kwh": 26, "sockets": 2, "stock": 1
}
```

`stock` is the number of sockets free right now. It is calculated from saved bookings, not stored.

## 2. GET /api/products/:id

One charger, for the station page.

- **200**: one charger (same shape as above).
- **404**: `{"error": "Product not found"}`. Also returned if `:id` is not a positive whole number.

## 3. GET /api/products/:id/availability

Start times that are still open on one day. Used by the "Open start times" dropdown.

| Query | Default | Rule |
|-------|---------|------|
| `date` | today | `YYYY-MM-DD`, from today up to 6 days later (Manila time) |
| `kwh` | 20 | Greater than 0 and at most 200. Decides how long a free window is needed. |

- **200**: 

```json
{
  "product_id": 1, "date": "2026-11-17", "kwh": 20,
  "charging_minutes": 24, "slot_count": 1,
  "starts": [
    { "time": "10:00", "slot_start": "2026-11-17T02:00:00.000Z", "slot_end": "2026-11-17T02:30:00.000Z",
      "free_sockets": 2, "off_peak": false }
  ]
}
```

- **400**: `date` is invalid or out of range, or `kwh` is invalid.
- **404**: the charger does not exist.

## 4. GET /api/stations

One summary per station (chargers grouped by station). Used by the map page (`frontend-map`). Takes the same filters as route 1.

- **200**: array of stations:

```json
{
  "id": 1, "name": "UP Town Center", "address": "Katipunan Ave, Quezon City",
  "location": { "type": "Point", "coordinates": [121.0733, 14.6537] },
  "freeSockets": 3, "totalSockets": 4,
  "connectors": ["CCS2", "Type2"], "pricing": "PAID", "pricePerKwh": 24,
  "hours": "Daily 10:00 AM to 9:00 PM", "products": [1, 2]
}
```

`coordinates` is `[longitude, latitude]`. `pricePerKwh` is the cheapest paid charger, or `0` if every charger is free.

- **400**: `connector` or `pricing` is not a valid value.

## 5. POST /api/orders

Saves a booking. Called by the checkout page when the driver clicks "Pay securely". The server works out the bill itself and ignores any total sent by the browser.

Body:

```json
{
  "customer_name": "Ana Cruz",
  "customer_email": "ana@example.com",
  "product_id": 1,
  "kwh": 20,
  "payment_method": "GCash",
  "slot_start": "2026-11-17T04:00:00.000Z"
}
```

| Field | Rule |
|-------|------|
| `customer_name` | 2 to 80 characters |
| `customer_email` | Valid email, up to 120 characters |
| `product_id` | A charger id (positive whole number) |
| `kwh` | Greater than 0, at most 200 |
| `payment_method` | `GCash`, `Maya Wallet`, `Card` or `Watt Credits` |
| `slot_start` | Date and time (ISO text) |

Time rules: not in the past (5 minutes of grace), at most 7 days ahead, on the hour or half hour, and the whole charge must fit inside the station's opening hours.

- **201**: the saved booking:

```json
{
  "id": 5, "product_id": 1, "station_id": 1,
  "customer_name": "Ana Cruz", "customer_email": "ana@example.com",
  "payment_method": "GCash", "socket": "UP Town Center · CCS2 DC", "kwh": 20,
  "slot_start": "2026-11-17T04:00:00.000Z", "slot_end": "2026-11-17T04:30:00.000Z",
  "socket_frees_at": "2026-11-17T04:40:00.000Z", "charging_minutes": 24,
  "breakdown": { "price_per_kwh": 26, "charging": 520, "reservation_fee": 50, "deposit": 100 },
  "total": 670, "revenue": 570,
  "points_earned": 10, "points_redeemed": 0, "points_balance": 10,
  "status": "confirmed", "createdAt": "2026-11-16T03:00:00.000Z"
}
```

- **400**: a field is missing or invalid (`error` is the first message, `fields` lists all of them), or a time rule is broken:
  - `Arrival time must be in the future`
  - `You can book up to 7 days ahead`
  - `Arrival time must be on the hour or half hour`
  - `<Station> is open <hours>. A <n>-minute charge starting <time> does not fit.`
- **404**: `{"error": "Socket not found"}`: no charger has that `product_id`.
- **409**: the booking conflicts with something already saved:
  - No socket is free for the whole charge window. The body includes `suggested_times`, up to 4 later open times that day: `[{ "time": "14:00", "slot_start": "..." }]`.
  - Paying with Watt Credits but the customer does not have enough.
  - Two first-time bookings with the same new email at the same moment (`Please try again.`).

The booking, the customer's record and their Watt Credits are saved in one transaction: either all of it is saved or none of it is.

## 6. GET /api/orders/:id

One booking, for the confirmation page.

- **200**: one booking (same shape as the 201 above).
- **404**: `{"error": "Order not found"}`. Also returned if `:id` is not a positive whole number.

## 7. GET /api/orders

All bookings, newest first. Used by the owner dashboard.

| Query | Default | Rule |
|-------|---------|------|
| `page` | 1 | 1 or more |
| `limit` | 100 | 1 to 100 |

- **200**: array of bookings.
- **400**: `page must be 1 or more and limit 1 to 100`.

## 8. GET /api/metrics

The owner dashboard numbers, calculated from saved bookings.

- **200**:

```json
{
  "total_orders": 12,
  "total_revenue": 5400,
  "average_order_value": 450,
  "top_selling_station": { "id": 1, "name": "UP Town Center", "orders": 7, "kwh": 140.5 },
  "low_stock": [
    { "id": 1, "name": "UP Town Center · CCS2 DC", "date": "2026-11-17", "available_slots": 4, "total_slots": 48 }
  ],
  "reservation_fee_revenue": 600,
  "watt_credits_issued": 80,
  "watt_credits_redeemed": 10
}
```

`total_revenue` leaves out the refundable ₱100 deposits. `top_selling_station` is `null` when there are no bookings. `low_stock` lists charger-days that are 80% or more booked over the next 7 days.

## 9. POST /api/reports

Saves an incident report ("Report an issue" form). New reports start as `open`.

Body:

```json
{
  "station_id": 1,
  "issue_type": "Broken charger",
  "description": "The plug will not lock in place.",
  "reporter_name": "Ana Cruz",
  "reporter_email": "ana@example.com"
}
```

| Field | Rule |
|-------|------|
| `station_id` | Required. The form sends a charger id; a station id is also accepted (charger ids are checked first). |
| `issue_type` | `Broken charger`, `Socket blocked`, `Payment problem`, `Station closed` or `Other` |
| `description` | 10 to 500 characters |
| `reporter_name` | Optional, up to 80 characters |
| `reporter_email` | Optional, must be a valid email if given |

- **201**: the saved report:

```json
{
  "id": 1, "station_id": 1, "station": "UP Town Center",
  "issue_type": "Broken charger", "description": "The plug will not lock in place.",
  "reporter_name": "Ana Cruz", "reporter_email": "ana@example.com",
  "status": "open", "createdAt": "2026-11-16T03:00:00.000Z", "resolvedAt": null
}
```

- **400**: a field is missing or invalid.
- **404**: `{"error": "Station not found"}`.

## 10. GET /api/reports

The 100 newest reports, newest first (owner dashboard).

- **200**: array of reports (same shape as above).

## 11. PATCH /api/reports/:id/resolve

The owner's "Mark resolved" button. It changes part of an existing report, so it uses PATCH, not POST.

- **200**: the updated report, with `"status": "resolved"` and `resolvedAt` filled in.
- **404**: `{"error": "Report not found"}`. Also returned if `:id` is not a positive whole number.

---

## Other routes (not part of the API)

| Method | Route | What it does |
|--------|-------|--------------|
| GET | `/` | Redirects to `/app/index.html` |
| GET | `/frontend-map/config.js` | Sends the Mapbox token (from the `MAPBOX_TOKEN` setting in `.env`) and `API_URL = "/api/stations"` to the map page |
| GET | `/app/...` | Static pages from `front end - max/` |
| GET | `/shop/...`, `/checkout/...`, `/owner/...` | Static pages from those folders |

## Business rules the routes use

These are all in `server/config.js`, so changing one is a one-line edit.

| Rule | Value |
|------|-------|
| Booking slots | 30 minutes, starting on the hour or half hour |
| Book ahead | Up to 7 days |
| Past grace | A slot that started less than 5 minutes ago can still be booked |
| Reservation fee | ₱50 (counts as revenue) |
| Deposit | ₱100 (refundable, not counted as revenue) |
| Largest charge | 200 kWh |
| Watt Credits | 1 credit per ₱50 of charging fee, doubled for charging between 10 PM and 6 AM; 1 credit is worth ₱1 when paying |
