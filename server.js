require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();

app.use(express.json());
app.use(express.static(__dirname));
app.use(express.static('public'));

for (const dir of ['home', 'shop', 'checkout', 'owner']) {
  const full = path.join(__dirname, dir);
  if (fs.existsSync(full)) app.use('/' + dir, express.static(full));
}

const FRONT = path.join(__dirname, 'front end - max');
if (fs.existsSync(FRONT)) {
  app.use('/app', express.static(FRONT));
  app.use('/front end - max', express.static(FRONT));
  app.get('/', (req, res) => res.redirect('/app/index.html'));
} else {
  app.get('/', (req, res) => res.redirect('/shop/stations.html'));
}

const PORT = process.env.PORT || 3000;

const RESERVATION_FEE = 50;
const DEPOSIT = 100;
const PAYMENT_METHODS = ['GCash', 'Maya Wallet', 'Card', 'Watt Credits'];

let products = [
  { id: 1, name: "UP Town Center · Socket #1", address: "UP Town Center, Katipunan Avenue, Diliman, Quezon City", connector: "Type 2 AC", power_kw: 22, hours: "Daily 10:00 AM to 9:00 PM", description: "Mall parking charger. Sample listing for the GC2 demo.", price_per_kwh: 26, stock: 4 },
  { id: 2, name: "Eastwood Mall · Socket #1", address: "Eastwood Mall, Eastwood City, Libis, Quezon City", connector: "CCS2 DC", power_kw: 50, hours: "Daily 10:00 AM to 10:00 PM", description: "Free charging promo with a reservation fee. Sample listing for the GC2 demo.", price_per_kwh: 0, stock: 2 },
  { id: 3, name: "SM North EDSA · Socket #1", address: "SM City North EDSA, North Avenue, Quezon City", connector: "CCS2 DC", power_kw: 50, hours: "Daily 10:00 AM to 9:00 PM", description: "Fast-charging bay. Sample listing for the GC2 demo.", price_per_kwh: 24, stock: 0 }
];

let orders = [];

app.get('/api/products', (req, res) => {
  const q = req.query.q ? req.query.q.toLowerCase() : '';
  const filtered = products.filter(p => p.name.toLowerCase().includes(q));
  res.status(200).json(filtered);
});

app.get('/api/products/:id', (req, res) => {
  const product = products.find(p => p.id === parseInt(req.params.id));
  if (!product) return res.status(404).json({ error: "Product not found" });
  res.status(200).json(product);
});

app.post('/api/orders', (req, res) => {
  const { customer_name, customer_email, payment_method, product_id, kwh, slot_start } = req.body;

  if (!customer_name || !customer_email || !product_id || kwh === undefined || kwh === null)
    return res.status(400).json({ error: "Missing required fields" });

  const numKwh = Number(kwh);
  if (isNaN(numKwh) || numKwh <= 0)
    return res.status(400).json({ error: "kWh must be a positive number greater than 0" });

  if (!PAYMENT_METHODS.includes(payment_method))
    return res.status(400).json({ error: "Invalid payment method" });

  const slot = new Date(slot_start);
  if (!slot_start || isNaN(slot.getTime()))
    return res.status(400).json({ error: "Pick a valid arrival date and time" });
  if (slot.getTime() < Date.now() - 5 * 60 * 1000)
    return res.status(400).json({ error: "Arrival time must be in the future" });

  const socket = products.find(p => p.id === parseInt(product_id));
  if (!socket) return res.status(404).json({ error: "Socket not found" });
  if (socket.stock < 1)
    return res.status(409).json({ error: "No free sockets at this station" });

  const charging = Math.round(socket.price_per_kwh * numKwh * 100) / 100;
  const total = Math.round((charging + RESERVATION_FEE + DEPOSIT) * 100) / 100;
  socket.stock -= 1;

  const order = {
    id: orders.length + 1,
    customer_name,
    customer_email,
    payment_method,
    socket: socket.name,
    kwh: numKwh,
    slot_start: slot.toISOString(),
    breakdown: { charging, reservation_fee: RESERVATION_FEE, deposit: DEPOSIT },
    total,
    createdAt: new Date().toISOString()
  };
  orders.push(order);
  res.status(201).json(order);
});

app.get('/api/orders', (req, res) => {
  res.status(200).json([...orders].reverse());
});

app.get('/api/metrics', (req, res) => {
  const round = n => Math.round(n * 100) / 100;
  const totalOrders = orders.length;
  const totalRevenue = round(orders.reduce((sum, o) => sum + o.total, 0));
  const averageOrderValue = totalOrders ? round(totalRevenue / totalOrders) : 0;

  const byStation = {};
  for (const o of orders) {
    const s = byStation[o.socket] || (byStation[o.socket] = { name: o.socket, orders: 0, kwh: 0 });
    s.orders += 1;
    s.kwh = round(s.kwh + o.kwh);
  }
  const ranked = Object.values(byStation).sort((a, b) => b.orders - a.orders || b.kwh - a.kwh);

  const lowStock = products
    .filter(p => p.stock < 5)
    .map(p => ({ id: p.id, name: p.name, available_slots: p.stock }));

  res.status(200).json({
    total_orders: totalOrders,
    total_revenue: totalRevenue,
    average_order_value: averageOrderValue,
    top_selling_station: ranked[0] || null,
    low_stock: lowStock
  });
});

const ISSUE_TYPES = ['Broken charger', 'Socket blocked', 'Payment problem', 'Station closed', 'Other'];
let reports = [];

app.post('/api/reports', (req, res) => {
  const { station_id, issue_type, description, reporter_name, reporter_email } = req.body;
  if (!station_id || !issue_type || !description)
    return res.status(400).json({ error: "Station, issue type, and description are required" });
  if (!ISSUE_TYPES.includes(issue_type))
    return res.status(400).json({ error: "Invalid issue type" });
  const text = String(description).trim();
  if (text.length < 10 || text.length > 500)
    return res.status(400).json({ error: "Description must be 10 to 500 characters" });
  if (reporter_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reporter_email))
    return res.status(400).json({ error: "Enter a valid email address" });
  const station = products.find(p => p.id === parseInt(station_id));
  if (!station) return res.status(404).json({ error: "Station not found" });

  const report = {
    id: reports.length + 1,
    station_id: station.id,
    station: station.name,
    issue_type,
    description: text,
    reporter_name: reporter_name ? String(reporter_name).trim() : '',
    reporter_email: reporter_email || '',
    status: 'open',
    createdAt: new Date().toISOString()
  };
  reports.push(report);
  res.status(201).json(report);
});

app.get('/api/reports', (req, res) => {
  res.status(200).json([...reports].reverse());
});

app.patch('/api/reports/:id/resolve', (req, res) => {
  const report = reports.find(r => r.id === parseInt(req.params.id));
  if (!report) return res.status(404).json({ error: "Report not found" });
  report.status = 'resolved';
  report.resolvedAt = new Date().toISOString();
  res.status(200).json(report);
});

app.get('/api/orders/:id', (req, res) => {
  const order = orders.find(o => o.id === parseInt(req.params.id));
  if (!order) return res.status(404).json({ error: "Order not found" });
  res.status(200).json(order);
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
