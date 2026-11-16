Challenge 5:

Althea Antonet Armendarez

Function: (chargingWindow*kwh, powerKw, slotStart) in server/pricing.js

**description**

Behavior:converts required charging energy (kWh) into charging duration (minutes), rounds up to the nearest whole 30 minute booking slot, and calculates the session end time.

Logic:
Energy Needed: Battery Capacity * (Target percentage - Start percentage)
Effective Speed: min(Charger Max kW, Vehicle Max kW)
Raw Minutes: (Energy Needed / Effective Speed) * 60
Booked Slots: (Raw Minutes / 30)

Test Environment:

Endpoint: POST /api/bookings/quote (via POSTMAN)
Charger Plug: CWH-DC1 — Commonwealth Hub (120 kW max, open 24/7)

Start Time (slotStart): 10:00 AM (Manila)

Pre-Run Predictions:
Case 1 — 50 kWh battery, 100 kW max (20% → 80%)
Energy & Speed: 30 kWh @ 100 kW
Predicted Duration: 18 min → 1 slot (30 min)
Predicted End (Manila): 10:30 AM

Note: I had run this input once while setting up Postman before recording.

Case 2 — 40 kWh battery, 11 kW max (50% → 60%)
Energy & Speed: 4 kWh @ 11 kW
Predicted Duration: 21.82 min → 1 slot (30 min)
Predicted End (Manila): 10:30 AM

Case 3 — 50 kWh battery, 50 kW max (20% → 70%)
Energy & Speed: 25 kWh @ 50 kW
Predicted Duration: 30 min → 1 slot (30 min)
Predicted End (Manila): 10:30 AM

Change (Boundary Test) — Same as #3, target increased to 71%
Energy & Speed: 25.5 kWh @ 50 kW
Predicted Duration: 30.6 min → 2 slots (60 min)
Predicted End (Manila): 11:00 AM

Boundary Note: Increasing the target by 1% pushes the raw duration from exactly 30.0 min to 30.6 min, crossing the 30-minute threshold and triggering a second booking slot.


post-run results:

Case 1: 18 min, 1 slot, ends 10:30 AM. Match: Yes. Why: 50 × (80 − 20) ÷ 100 = 30 kWh. The speed is the lower of the plug (120 kW) 
and the car (100 kW), so 100 kW. 30 ÷ 100 × 60 = 18 minutes exactly, 
which fits inside one 30-minute slot, so it ends at 10:30 AM.

Case 2: 22 min, 1 slot, ends 10:30 AM. Match: Minutes no (predicted 21.82), slots and end yes. Why: 40 × (60 − 50) ÷ 100 = 4 kWh at 11 kW (the car's limit)
 gives 21.82 minutes. I kept the decimal, but chargingWindow uses Math.ceil on 
 the minutes first, so 21.82 is rounded up to 22 whole minutes. 22 minutes still fits in one slot, so the slot count and end time matched.

Case 3: 30 min, 1 slot, ends 10:30 AM. Match: Yes. Why: 50 × (70 − 20) ÷ 100 = 25 kWh
 at 50 kW (the car's limit) is exactly 30 minutes. 
 Math.ceil leaves a whole number unchanged, and 30 ÷ 30 = 1, 
 so it stays at exactly one slot with no extra slot added.

Change (71%): 31 min, 2 slots, ends 11:00 AM. Match: Yes. Why: Raising the target by 1% adds 0.5 kWh (25.5 kWh total), which takes 30.6 minutes. Math.ceil rounds that up to 31 minutes, and 31 ÷ 30 = 1.03, which rounds up to 2 slots. 
So one extra percent pushes the booking past the 30-minute line, adds a second slot, and moves the end time to 11:00 AM.

recording: https://drive.google.com/file/d/11UCx8Vv9kpNP6nSkqqbfLUjRaE6edl1Q/view?usp=sharing 
