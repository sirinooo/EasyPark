const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Allow the GitHub Pages frontend and the ESP32 to talk to this API.
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Only Slot 101 is connected to the real ESP32 for this prototype.
let slot101Occupied = false;
let slot101Reserved = false;
let slot101UpdatedAt = null;
let slot101ReservationUpdatedAt = null;

function statusPayload() {
  return {
    slotId: '101',
    occupied: slot101Occupied,
    reserved: slot101Reserved,
    // Reservation takes priority over occupancy for the physical LED/display.
    status: slot101Reserved ? 'reserved' : (slot101Occupied ? 'occupied' : 'available'),
    updatedAt: slot101UpdatedAt,
    reservationUpdatedAt: slot101ReservationUpdatedAt
  };
}

// ESP32 + webpage: read the complete live state.
app.get('/api/slots/101/status', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(statusPayload());
});

// Backwards-compatible presence endpoint for the webpage.
app.get('/api/slots/101/presence', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({
    slotId: '101',
    occupied: slot101Occupied,
    updatedAt: slot101UpdatedAt
  });
});

// ESP32 -> API: physical sensor state.
app.post('/api/slots/101/presence', (req, res) => {
  if (typeof req.body.occupied !== 'boolean') {
    return res.status(400).json({ error: 'occupied must be true or false' });
  }

  slot101Occupied = req.body.occupied;
  slot101UpdatedAt = new Date().toISOString();

  res.json({ ok: true, ...statusPayload() });
});

// Webpage -> API: reservation state for the physical Slot 101.
app.post('/api/slots/101/reservation', (req, res) => {
  if (typeof req.body.reserved !== 'boolean') {
    return res.status(400).json({ error: 'reserved must be true or false' });
  }

  slot101Reserved = req.body.reserved;
  slot101ReservationUpdatedAt = new Date().toISOString();

  res.json({ ok: true, ...statusPayload() });
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// Serve the existing project if this folder is deployed to Render.
app.use(express.static(__dirname));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`EasyPark API running on port ${PORT}`);
});
