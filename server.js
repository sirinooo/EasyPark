const express = require('express');

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
let slot101Reservation = {
  active: false,
  startsAt: null,
  endsAt: null
};

function isReservationActive() {
  if (!slot101Reservation.active || !slot101Reservation.endsAt) {
    return false;
  }

  const now = Date.now();
  const start = slot101Reservation.startsAt
    ? new Date(slot101Reservation.startsAt).getTime()
    : now;
  const end = new Date(slot101Reservation.endsAt).getTime();

  if (Number.isNaN(end) || now >= end) {
    slot101Reservation = {
      active: false,
      startsAt: null,
      endsAt: null
    };
    return false;
  }

  return now >= start && now < end;
}

function statusPayload() {
  const reserved = isReservationActive();

  // A physical car always means OCCUPIED.
  // BLUE/RESERVED is shown only when the slot is empty.
  const status = slot101Occupied
    ? 'occupied'
    : reserved
      ? 'reserved'
      : 'available';

  return {
    slotId: '101',
    occupied: slot101Occupied,
    reserved,
    reservationStartsAt: slot101Reservation.startsAt,
    reservationEndsAt: slot101Reservation.endsAt,
    status,
    updatedAt: new Date().toISOString()
  };
}

// ESP32 + webpage: read the complete live state.
app.get('/api/slots/101/status', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(statusPayload());
});

// Presence endpoint.
app.get('/api/slots/101/presence', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({
    slotId: '101',
    occupied: slot101Occupied,
    updatedAt: new Date().toISOString()
  });
});

// ESP32 -> API: physical sensor state.
app.post('/api/slots/101/presence', (req, res) => {
  if (typeof req.body.occupied !== 'boolean') {
    return res.status(400).json({
      error: 'occupied must be true or false'
    });
  }

  slot101Occupied = req.body.occupied;

  console.log('Slot 101 occupied:', slot101Occupied);

  res.json({
    ok: true,
    ...statusPayload()
  });
});

// Webpage -> API: reservation state for the physical Slot 101.
app.post('/api/slots/101/reservation', (req, res) => {
  if (typeof req.body.reserved !== 'boolean') {
    return res.status(400).json({
      error: 'reserved must be true or false'
    });
  }

  if (!req.body.reserved) {
    slot101Reservation = {
      active: false,
      startsAt: null,
      endsAt: null
    };
  } else {
    if (!req.body.endsAt) {
      return res.status(400).json({
        error: 'endsAt is required when reserved is true'
      });
    }

    const endTime = new Date(req.body.endsAt).getTime();

    if (Number.isNaN(endTime)) {
      return res.status(400).json({
        error: 'Invalid endsAt'
      });
    }

    let startsAt = req.body.startsAt || new Date().toISOString();
    const startTime = new Date(startsAt).getTime();

    if (Number.isNaN(startTime)) {
      return res.status(400).json({
        error: 'Invalid startsAt'
      });
    }

    if (endTime <= startTime) {
      return res.status(400).json({
        error: 'endsAt must be after startsAt'
      });
    }

    slot101Reservation = {
      active: true,
      startsAt: new Date(startTime).toISOString(),
      endsAt: new Date(endTime).toISOString()
    };
  }

  console.log('Slot 101 reservation:', slot101Reservation);

  res.json({
    ok: true,
    ...statusPayload()
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'EasyPark API'
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`EasyPark API running on port ${PORT}`);
});
