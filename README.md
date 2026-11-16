WattSpot

WattSpot lets EV drivers in Quezon City see which public chargers are free across every network, book a 30-minute charging slot, and know when their charge will finish before they leave home. Drivers browse stations, pick a plug and a time, enter their car and battery %, and get a confirmed booking with an itemised bill. Every booking earns Watt Credits, double at night.

Live site: https://wattspot-test.onrender.com

ITMGT 45.03 · Group 5 · GC2

Team

M1 · Maverick Agbayani (@maverickagbayani), Database and deployment, Captain. Owns the MongoDB models and seed data, the switch from MySQL to MongoDB, and the Render deploy.
M3 · Alysa Maxine Marquez (@alysamaxine), Front end. Owns the home, car setup, station list, station detail and map pages (front end - max/).
M4 · Althea Armendarez (@altheaarmendarez), Back end. Owns the API routes, validation, pricing and availability (server/, server.js), plus the shop, checkout and owner pages.
M5 · Zaira Venice Farrales (@zaifarrales), UI/UX and map. Owns the interactive map (frontend-map/) and the page design.

Tech stack

Node.js 24.x. One JavaScript runtime for the server, the same language as the front end.
Express 5.3. A small web framework: one service serves both the pages and the /api routes.
MongoDB Atlas (cloud, free tier). A hosted database the whole team can reach, with a geospatial index for "stations near me".
Mongoose 9.12. Schemas, validation and transactions on top of MongoDB.
dotenv 18.0. Loads MONGODB_URI and other settings from .env, so no secrets live in the code.
Plain HTML, CSS and JavaScript (fetch). Simple pages with no build step. The Final Project moves to React.
Mapbox GL JS 3.4. The interactive map of the stations.
Render (free web service). Hosts the app from GitHub and redeploys when main changes.
Postman (desktop app). Tests every API route, including the Challenge 1 break tests (docs/postman_collection.json).

Run it locally
1. Install Node.js 24.
2. Install the dependencies:
    
        npm install
3. Copy .env.example to .env and fill in the values. Ask a teammate privately for the database link.
        cp .env.example .env
4. Add the stations to the database (10 Quezon City stations, 28 plugs):

    npm run seed

Do not run npm run seed -- --reset on the shared database: it deletes every booking, customer and report. 
5. Start the server:
    npm start

6. Open http://localhost:3000. npm run dev restarts automatically when files change.

Environment variables

Names only. Real values go in your own .env (never committed) and in Render's Environment settings.

    MONGODB_URI: MongoDB Atlas connection string (required)
    MAPBOX_TOKEN: Mapbox public token for the map view
    PORT: port to listen on. Render sets this itself; locally it defaults to 3000

Changes since GC1

    Removed other drivers' live battery %. The GC1 station page showed it, but Phase 1 has no way to collect other cars' battery data (GC1 feedback). Pages now show which plugs are booked or free, worked out from saved bookings.
    
    Added the ₱50 reservation fee to our revenue model. GC1 only listed a premium pass and ads, even though our checkout mockup charged this fee (GC1 feedback). The ₱100 overstay deposit is refundable, so it is not counted as revenue.
    
    Made booking the core flow. Booking was a Phase 2 feature in GC1. GC2 needs a full flow that saves to a database, so it is now browse → select → confirm → save.
    
    Defined when a socket frees up. GC1 feedback asked when a check-in ends. Each booking now holds whole 30-minute slots, and the plug frees 10 minutes after the booked window ends.
    
    Turned loyalty points into Watt Credits. Instead of points for accurate reports, drivers earn 1 credit per ₱50 of charging, double from 10 PM to 6 AM, and can pay with them. It is a simple rule tied to bookings that we can test.
    
    Added an owner view. GC1 had no admin screen for incident reports (GC1 feedback). The owner page now lists bookings, five metrics, and incident reports with a "Mark resolved" button.
    
    Kept plain HTML, CSS and JavaScript for now. GC1 planned a MERN stack with React. We kept the front end simple for GC2 and plan React for the Final Project.
    
    Tried MySQL, then switched to MongoDB. We built a MySQL backend first, then moved to MongoDB Atlas with Mongoose. It matched our GC1 plan (geospatial index) and gave the team one shared database.
    
    Left out premium subscriptions and accounts. They are outside the GC2 flow, so we kept them for later.

Documentation

docs/route-table.md: route table
docs/schema.md: database schema
docs/system-diagram.md: system diagram and how an order flows
docs/challenges.md: GC2 challenges 1 to 5
docs/baseline.md: performance baseline for the Final Project
docs/business.md: business model and revenue numbers
docs/postman_collection.json: exported Postman tests
AI-USAGE.md: how we used AI
CONTRIBUTING.md: our Git workflow
