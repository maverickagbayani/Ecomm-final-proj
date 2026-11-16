# server/

- `config.js`: every business rule (fees, slot length, points rate). Change rules here only.
- `pricing.js`: all money and charging-time math.
- `availability.js`: open-slot math. It's pure functions and never touches the database.
- `validate.js`: re-checks every field the browser sends.
- `format.js`: turns database documents into API JSON.
- `time.js`: Manila time helpers.
- `db.js`: MongoDB connection and the transaction helper.
- `models/`: Mongoose schemas and indexes (`stations`, `bookings`, `slotholds`, `customers`, `reports`).
- `repositories/`: the only files that query MongoDB.
- `routes/`: Express routes, mounted under `/api`.
