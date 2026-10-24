const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.json());
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

const SLOT_IDS = Array.from({ length: 8 }, (_, i) => String(101 + i));
const slots = Object.fromEntries(SLOT_IDS.map(slotId => [slotId, {
  occupied: false,
  reservation: { active: false, startsAt: null, endsAt: null },
  updatedAt: new Date().toISOString()
}]));
function getSlot(slotId) { return SLOT_IDS.includes(String(slotId)) ? slots[String(slotId)] : null; }
function isReservationActive(slot) {
  const r = slot.reservation;
  if (!r.active || !r.endsAt) return false;
  const now = Date.now();
  const start = r.startsAt ? new Date(r.startsAt).getTime() : now;
  const end = new Date(r.endsAt).getTime();
  if (Number.isNaN(end) || Number.isNaN(start) || now >= end) {
    slot.reservation = { active: false, startsAt: null, endsAt: null };
    return false;
  }
  return now >= start && now < end;
}
function statusPayload(slotId) {
  const slot = getSlot(slotId);
  const reserved = isReservationActive(slot);
  return {
    slotId: String(slotId), occupied: slot.occupied, reserved,
    reservationStartsAt: slot.reservation.startsAt,
    reservationEndsAt: slot.reservation.endsAt,
    status: slot.occupied ? 'occupied' : reserved ? 'reserved' : 'available',
    updatedAt: slot.updatedAt
  };
}
app.get('/api/slots', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(SLOT_IDS.map(id => statusPayload(id)));
});
app.get('/api/slots/:slotId/status', (req, res) => {
  const slot = getSlot(req.params.slotId);
  if (!slot) return res.status(404).json({ error: 'Unknown slot ID. Valid slots: 101–108.' });
  res.set('Cache-Control', 'no-store');
  res.json(statusPayload(req.params.slotId));
});
app.get('/api/slots/:slotId/presence', (req, res) => {
  const slot = getSlot(req.params.slotId);
  if (!slot) return res.status(404).json({ error: 'Unknown slot ID. Valid slots: 101–108.' });
  res.set('Cache-Control', 'no-store');
  res.json({ slotId: String(req.params.slotId), occupied: slot.occupied, updatedAt: slot.updatedAt });
});
app.post('/api/slots/:slotId/presence', (req, res) => {
  const slot = getSlot(req.params.slotId);
  if (!slot) return res.status(404).json({ error: 'Unknown slot ID. Valid slots: 101–108.' });
  if (typeof req.body.occupied !== 'boolean') return res.status(400).json({ error: 'occupied must be true or false' });
  slot.occupied = req.body.occupied;
  slot.updatedAt = new Date().toISOString();
  console.log(`Slot ${req.params.slotId} occupied:`, slot.occupied);
  res.json({ ok: true, ...statusPayload(req.params.slotId) });
});
app.post('/api/slots/:slotId/reservation', (req, res) => {
  const slot = getSlot(req.params.slotId);
  if (!slot) return res.status(404).json({ error: 'Unknown slot ID. Valid slots: 101–108.' });
  if (typeof req.body.reserved !== 'boolean') return res.status(400).json({ error: 'reserved must be true or false' });
  if (!req.body.reserved) {
    slot.reservation = { active: false, startsAt: null, endsAt: null };
  } else {
    if (!req.body.endsAt) return res.status(400).json({ error: 'endsAt is required when reserved is true' });
    const end = new Date(req.body.endsAt).getTime();
    const startsAt = req.body.startsAt || new Date().toISOString();
    const start = new Date(startsAt).getTime();
    if (Number.isNaN(end) || Number.isNaN(start)) return res.status(400).json({ error: 'Invalid reservation date' });
    if (end <= start) return res.status(400).json({ error: 'endsAt must be after startsAt' });
    slot.reservation = { active: true, startsAt: new Date(start).toISOString(), endsAt: new Date(end).toISOString() };
  }
  slot.updatedAt = new Date().toISOString();
  console.log(`Slot ${req.params.slotId} reservation:`, slot.reservation);
  res.json({ ok: true, ...statusPayload(req.params.slotId) });
});
app.get('/api/health', (req, res) => res.json({ ok: true, service: 'EasyPark API', slots: SLOT_IDS }));
app.listen(PORT, '0.0.0.0', () => console.log(`EasyPark API running on port ${PORT}`));
