
/* ==========================================================================
   EasyPark — Smart Parking Reservation & Management System
   2nd Year Engineering Clinics Project
   --------------------------------------------------------------------------
   db.js — Live data layer for physical parking slots 101–108
   ========================================================================== */

(function () {
  'use strict';

  /* 1. Constants */

  const STORAGE_KEY = 'easypark_app_v1';
  const ADMIN_USER = 'admin';
  const ADMIN_PASS = 'park2026';

  const REAL_SENSOR_SLOTS = [
    '101', '102', '103', '104',
    '105', '106', '107', '108'
  ];

  const LIVE_API_BASE = 'https://easypark-1yd1.onrender.com';

  const liveSlots = Object.create(null);
  const liveReservationSignatures = Object.create(null);

  async function pollRealSensors() {
    let changed = false;

    await Promise.all(REAL_SENSOR_SLOTS.map(async slotId => {
      try {
        const response = await fetch(
          LIVE_API_BASE + '/api/slots/' + slotId + '/status',
          { cache: 'no-store' }
        );

        if (!response.ok) {
          throw new Error('Sensor API returned ' + response.status);
        }

        const data = await response.json();

        if (
          typeof data.occupied !== 'boolean' ||
          typeof data.reserved !== 'boolean'
        ) {
          throw new Error('Invalid live status for Slot ' + slotId);
        }

        const previous = liveSlots[slotId];

        if (
          !previous ||
          previous.occupied !== data.occupied ||
          previous.reserved !== data.reserved
        ) {
          changed = true;
        }

        liveSlots[slotId] = {
          occupied: data.occupied,
          reserved: data.reserved,
          loaded: true
        };
      } catch (error) {
        console.warn(
          'Could not refresh Slot ' + slotId + ':',
          error.message
        );
      }
    }));

    if (
      changed &&
      typeof window.EasyParkLiveRefresh === 'function'
    ) {
      window.EasyParkLiveRefresh();
    }
  }

  async function syncLiveReservations() {
    if (!state) return;

    const now = new Date();

    await Promise.all(REAL_SENSOR_SLOTS.map(async slotId => {
      try {
        const activeReservation = state.reservations
          .filter(r =>
            String(r.slot) === slotId &&
            r.status === 'approved'
          )
          .map(r => {
            const startsAt = new Date(r.date + 'T' + r.start + ':00');
            const endsAt = new Date(
              startsAt.getTime() +
              Number(r.duration) * 60 * 60 * 1000
            );

            return { startsAt, endsAt };
          })
          .filter(r => now >= r.startsAt && now < r.endsAt)
          .sort((a, b) => a.startsAt - b.startsAt)[0];

        const body = activeReservation
          ? {
              reserved: true,
              startsAt: activeReservation.startsAt.toISOString(),
              endsAt: activeReservation.endsAt.toISOString()
            }
          : { reserved: false };

        const payload = JSON.stringify(body);

        if (liveReservationSignatures[slotId] === payload) {
          return;
        }

        const response = await fetch(
          LIVE_API_BASE + '/api/slots/' + slotId + '/reservation',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload
          }
        );

        if (!response.ok) {
          throw new Error('Reservation API returned ' + response.status);
        }

        liveReservationSignatures[slotId] = payload;
      } catch (error) {
        console.warn(
          'Could not sync reservation for Slot ' + slotId + ':',
          error.message
        );
      }
    }));
  }

  /* 2. Slot and component metadata */

  const SLOT_META = [
    { id: '101', floor: 'ground', level: 'Ground Floor' },
    { id: '102', floor: 'ground', level: 'Ground Floor' },
    { id: '103', floor: 'ground', level: 'Ground Floor' },
    { id: '104', floor: 'ground', level: 'Ground Floor' },
    { id: '105', floor: 'first', level: 'First Floor' },
    { id: '106', floor: 'first', level: 'First Floor' },
    { id: '107', floor: 'first', level: 'First Floor' },
    { id: '108', floor: 'first', level: 'First Floor' }
  ];

  const COMPONENTS = [
    {
      key: 'ir',
      name: 'IR Sensor',
      defaultFault: 'IR sensor not responding',
      badge: 'sensor_fault'
    },
    {
      key: 'qr',
      name: 'QR Tag',
      defaultFault: 'QR code damaged',
      badge: 'inspection_pending'
    },
    {
      key: 'led',
      name: 'LED Strip',
      defaultFault: 'LED strip malfunction',
      badge: 'electrical_fault'
    },
    {
      key: 'esp32',
      name: 'ESP32',
      defaultFault: 'ESP32 communication lost',
      badge: 'electrical_fault'
    }
  ];

  const MAINT_STATES = [
    { key: 'operational', label: 'Operational' },
    { key: 'under_maintenance', label: 'Under Maintenance' },
    { key: 'sensor_fault', label: 'Sensor Fault' },
    { key: 'electrical_fault', label: 'Electrical Fault' },
    { key: 'inspection_pending', label: 'Inspection Pending' }
  ];

  const RES_STATUSES = [
    'pending', 'approved', 'cancelled', 'completed'
  ];

  const SLOT_STATUSES = {
    available: {
      label: 'Available',
      cls: 'available'
    },
    occupied: {
      label: 'Occupied',
      cls: 'occupied'
    },
    reserved: {
      label: 'Reserved',
      cls: 'reserved'
    },
    maintenance: {
      label: 'Under Maintenance',
      cls: 'maintenance'
    }
  };

  /* 3. Date helpers */

  function iso(d) {
    return d.toISOString().slice(0, 10);
  }

  function todayISO() {
    return iso(new Date());
  }

  function daysFromNow(n) {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return iso(d);
  }

  function fmtDate(isoDate) {
    if (!isoDate) return '—';

    const d = new Date(isoDate + 'T00:00:00');

    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }

  function fmtTime(t) {
    if (!t) return '—';

    const [h, m] = t.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hh = h % 12 === 0 ? 12 : h % 12;

    return hh + ':' + String(m).padStart(2, '0') + ' ' + ampm;
  }

  function modIndex(i, len) {
    return ((i % len) + len) % len;
  }

  /* 4. Local storage */

  let state = null;

  function defaultState() {
    return {
      version: 2,
      reservations: [],
      issues: [],
      health: {},
      presence: {},
      notifications: [],
      users: [],
      session: null,
      adminSession: false
    };
  }

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

    window.dispatchEvent(new CustomEvent('easypark:update'));
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);

      state = raw
        ? Object.assign(defaultState(), JSON.parse(raw))
        : null;
    } catch (error) {
      state = null;
    }

    if (!state) {
      state = defaultState();
      seed();
      persist();
      return;
    }

    // Migrate the old demo's first-floor IDs to physical IDs 105–108.
    const slotMap = {
      '201': '105',
      '202': '106',
      '203': '107',
      '204': '108'
    };

    if (state.reservations) {
      state.reservations.forEach(r => {
        if (slotMap[String(r.slot)]) {
          r.slot = slotMap[String(r.slot)];
        }

        if (r.floor === 'first') {
          r.floor = 'first';
        }
      });
    }

    if (state.presence) {
      Object.keys(slotMap).forEach(oldId => {
        const newId = slotMap[oldId];

        if (state.presence[oldId] !== undefined) {
          if (state.presence[newId] === undefined) {
            state.presence[newId] = state.presence[oldId];
          }

          delete state.presence[oldId];
        }
      });
    }

    if (state.health) {
      Object.keys(slotMap).forEach(oldId => {
        const newId = slotMap[oldId];

        if (state.health[oldId] !== undefined) {
          if (state.health[newId] === undefined) {
            state.health[newId] = state.health[oldId];
          }

          delete state.health[oldId];
        }
      });
    }

    if (state.issues) {
      state.issues.forEach(issue => {
        if (slotMap[String(issue.slotId)]) {
          issue.slotId = slotMap[String(issue.slotId)];
        }
      });
    }

    // Ensure every physical slot has component-health information.
    SLOT_META.forEach(slot => {
      if (!state.health[slot.id]) {
        state.health[slot.id] = {
          ir: 'ok',
          qr: 'ok',
          led: 'ok',
          esp32: 'ok'
        };
      }
    });

    // Persist the migrated structure.
    persist();
  }

  /* 5. Initial demo data */

  function seed() {
    state.presence = {};

    const ok = () => ({
      ir: 'ok',
      qr: 'ok',
      led: 'ok',
      esp32: 'ok'
    });

    state.health = {};

    SLOT_META.forEach(slot => {
      state.health[slot.id] = ok();
    });

    // Keep demo maintenance issues off the physical sensor slots.
    state.health['107'].esp32 = 'fault';

    state.issues = [
      {
        id: 'MNT-501',
        slotId: '107',
        component: 'esp32',
        issue: 'ESP32 communication issue — demo maintenance record',
        status: 'inspection_pending',
        open: true,
        createdAt: daysFromNow(-1),
        log: [
          {
            date: daysFromNow(-1),
            technician: 'Demo Technician',
            issue: 'Communication check required',
            resolutionStatus: 'Pending inspection'
          }
        ]
      }
    ];

    const R = (
      code, name, vehicle, phone, floor, slot,
      date, start, duration, status
    ) => ({
      id: code,
      name,
      vehicle,
      phone,
      floor,
      slot,
      date,
      start,
      duration,
      status,
      createdAt: iso(new Date())
    });

    state.reservations = [
      R(
        'RES-2041', 'Alex Morgan', 'MH 12 AB 3456',
        '98200 11223', 'ground', '101',
        todayISO(), '10:00', 2, 'approved'
      ),
      R(
        'RES-2043', 'Ravi Kumar', 'MH 02 EF 9102',
        '98111 44556', 'ground', '102',
        todayISO(), '13:00', 1, 'pending'
      ),
      R(
        'RES-2046', 'Nina D Souza', 'MH 48 KL 7788',
        '97654 33221', 'first', '105',
        todayISO(), '15:00', 2, 'approved'
      ),
      R(
        'RES-2047', 'Omar Farooq', 'DL 03 MN 1022',
        '90011 22004', 'ground', '104',
        todayISO(), '12:00', 1, 'cancelled'
      ),
      R(
        'RES-2042', 'Sarah Lee', 'MH 14 CD 7821',
        '98200 55667', 'first', '108',
        daysFromNow(1), '09:30', 3, 'approved'
      ),
      R(
        'RES-2045', 'Tom White', 'KA 01 IJ 2334',
        '98807 66772', 'ground', '103',
        daysFromNow(1), '16:00', 2, 'pending'
      ),
      R(
        'RES-2048', 'Elena Petrova', 'MH 20 PQ 3345',
        '91673 55678', 'ground', '102',
        daysFromNow(2), '10:30', 4, 'approved'
      ),
      R(
        'RES-2031', 'John Carter', 'MH 03 XY 7711',
        '98765 43210', 'ground', '101',
        daysFromNow(-1), '09:00', 2, 'completed'
      ),
      R(
        'RES-2032', 'Maria Gomez', 'GJ 05 RT 9012',
        '99221 33445', 'first', '106',
        daysFromNow(-2), '11:00', 2, 'completed'
      ),
      R(
        'RES-2033', 'Liam Wong', 'MH 12 YZ 4521',
        '98100 11223', 'ground', '104',
        daysFromNow(-3), '14:00', 1, 'completed'
      ),
      R(
        'RES-2034', 'Aisha Khan', 'MH 06 GH 5510',
        '98330 44556', 'first', '105',
        daysFromNow(-4), '10:00', 3, 'completed'
      ),
      R(
        'RES-2035', 'Diego Ruiz', 'KA 51 KK 6688',
        '97400 99887', 'ground', '103',
        daysFromNow(-5), '16:30', 2, 'completed'
      )
    ];

    const names = [
      ['Priya Nair', 'MH 01 AA 1101'],
      ['Sam Vora', 'MH 45 BB 2233'],
      ['Ivy Chen', 'KA 03 CC 3344'],
      ['Arun Das', 'MH 15 DD 4455'],
      ['Mia Lopez', 'GJ 12 EE 5566'],
      ['Dev Patel', 'MH 09 FF 6677'],
      ['Zoey Hall', 'DL 08 GG 7788'],
      ['Ken Ito', 'MH 22 HH 8899']
    ];

    const slotsById = SLOT_META.map(slot => slot.id);

    for (let d = -6; d >= -12; d--) {
      const n = 2 + modIndex(d, 3);

      for (let i = 0; i < n; i++) {
        const person = names[modIndex(d + i, names.length)];
        const slotId = slotsById[
          modIndex(d * 2 + i * 3, slotsById.length)
        ];
        const meta = SLOT_META.find(slot => slot.id === slotId);
        const start = 9 + modIndex(d * 3 + i, 9);

        state.reservations.push(R(
          'RES-' + (1000 + Math.abs(d * 10 + i)),
          person[0],
          person[1],
          '9' + String(100000000 + Math.abs(d * 7000 + i * 911)),
          meta.floor,
          meta.id,
          daysFromNow(d),
          String(start).padStart(2, '0') + ':00',
          1 + modIndex(d + i, 3),
          'completed'
        ));
      }
    }

    state.notifications = [
      {
        id: 'NTF-1',
        type: 'reservation',
        message: 'Demo reservation awaiting approval — Spot 102',
        time: todayISO(),
        read: false
      }
    ];

    state.users = [
      {
        name: 'Alex Morgan',
        phone: '98200 11223',
        email: 'alex@demo.in',
        password: 'user123'
      }
    ];

    state.session = null;
    state.adminSession = false;
  }

  /* 6. Derived slot status */

  function reservedToday() {
    const today = todayISO();

    return state.reservations
      .filter(r => r.status === 'approved' && r.date === today)
      .map(r => String(r.slot));
  }

  function outOfService() {
    const result = {};

    state.issues
      .filter(issue => issue.open)
      .forEach(issue => {
        result[String(issue.slotId)] = true;
      });

    SLOT_META.forEach(slot => {
      const health = state.health[slot.id] || {};

      if (Object.values(health).some(value => value === 'fault')) {
        result[slot.id] = true;
      }
    });

    return result;
  }

  function computeSlots() {
    const reserved = reservedToday();
    const maintenance = outOfService();

    return SLOT_META.map(meta => {
      let status = 'available';

      const live = liveSlots[meta.id];

      // Physical readings take priority over demo presence data.
      if (live && live.loaded) {
        if (live.occupied) {
          status = 'occupied';
        } else if (live.reserved) {
          status = 'reserved';
        } else {
          status = 'available';
        }
      } else if (maintenance[meta.id]) {
        status = 'maintenance';
      } else if (reserved.includes(meta.id)) {
        status = 'reserved';
      } else if (state.presence[meta.id]) {
        status = 'occupied';
      }

      const reservation = state.reservations.find(r =>
        String(r.slot) === meta.id &&
        r.status === 'approved' &&
        r.date === todayISO()
      );

      return Object.assign({}, meta, {
        status,
        reservation: reservation || null
      });
    });
  }

  function getSlots(floor) {
    const slots = computeSlots();

    return floor
      ? slots.filter(slot => slot.floor === floor)
      : slots;
  }

  function getSlot(id) {
    return computeSlots().find(slot => slot.id === String(id)) || null;
  }

  function getStats() {
    const slots = computeSlots();
    const count = status => slots.filter(slot => slot.status === status).length;

    return {
      total: slots.length,
      available: count('available'),
      occupied: count('occupied'),
      reserved: count('reserved'),
      maintenance: count('maintenance')
    };
  }

  /* 7. Maintenance actions */

  function togglePresence(slotId) {
    slotId = String(slotId);

    if (!SLOT_META.some(slot => slot.id === slotId)) {
      return null;
    }

    // Do not simulate occupancy for a slot whose physical sensor is online.
    if (liveSlots[slotId] && liveSlots[slotId].loaded) {
      return getSlot(slotId);
    }

    const slot = getSlot(slotId);

    if (!slot || slot.status === 'maintenance') {
      addNotification(
        'fault',
        'Cannot change presence — Spot ' + slotId + ' is under maintenance'
      );
      return null;
    }

    state.presence[slotId] = !state.presence[slotId];
    persist();

    return getSlot(slotId);
  }

  function setComponentHealth(slotId, compKey, healthy) {
    slotId = String(slotId);

    if (!SLOT_META.some(slot => slot.id === slotId)) {
      return null;
    }

    if (!state.health[slotId]) {
      state.health[slotId] = {
        ir: 'ok',
        qr: 'ok',
        led: 'ok',
        esp32: 'ok'
      };
    }

    const health = state.health[slotId];
    const component = COMPONENTS.find(c => c.key === compKey);

    if (!component) {
      return null;
    }

    if (healthy) {
      health[compKey] = 'ok';

      state.issues
        .filter(issue =>
          issue.slotId === slotId &&
          issue.component === compKey &&
          issue.open
        )
        .forEach(issue => {
          issue.open = false;
          issue.status = 'operational';
          issue.log.push({
            date: todayISO(),
            technician: 'Admin Console',
            issue: 'Component restored',
            resolutionStatus: 'Resolved'
          });
        });

      addNotification(
        'fault',
        'Spot ' + slotId + ' — ' + component.name + ' back to operational'
      );
    } else {
      health[compKey] = 'fault';

      const issueId = 'MNT-' + (600 + state.issues.length + 1);

      state.issues.push({
        id: issueId,
        slotId,
        component: compKey,
        issue: component.name + ' — ' + component.defaultFault,
        status: component.badge,
        open: true,
        createdAt: todayISO(),
        log: [{
          date: todayISO(),
          technician: 'Auto-detected',
          issue: component.defaultFault,
          resolutionStatus: 'Pending'
        }]
      });

      addNotification(
        'fault',
        'Fault detected at Spot ' + slotId + ' — ' + component.name
      );
    }

    persist();
    return health;
  }

  function setIssueStatus(issueId, status) {
    const issue = state.issues.find(item => item.id === issueId);

    if (!issue) {
      return null;
    }

    issue.status = status;

    if (status === 'operational') {
      issue.open = false;

      if (state.health[issue.slotId]) {
        state.health[issue.slotId][issue.component] = 'ok';
      }

      issue.log.push({
        date: todayISO(),
        technician: 'Admin Console',
        issue: 'Marked operational',
        resolutionStatus: 'Resolved'
      });
    } else {
      issue.open = true;

      if (state.health[issue.slotId]) {
        state.health[issue.slotId][issue.component] = 'fault';
      }
    }

    persist();
    return issue;
  }

  function addIssueLog(issueId, entry) {
    const issue = state.issues.find(item => item.id === issueId);

    if (!issue) {
      return null;
    }

    issue.log.push(entry);
    persist();

    return issue;
  }

  function reportIssue(slotId, componentKey, issueText, technician) {
    slotId = String(slotId);

    if (!SLOT_META.some(slot => slot.id === slotId)) {
      return null;
    }

    if (!state.health[slotId]) {
      state.health[slotId] = {
        ir: 'ok',
        qr: 'ok',
        led: 'ok',
        esp32: 'ok'
      };
    }

    const component = COMPONENTS.find(c => c.key === componentKey);

    if (!component) {
      return null;
    }

    state.health[slotId][componentKey] = 'fault';

    const issueId = 'MNT-' + (600 + state.issues.length + 1);
    const description = issueText || component.defaultFault;

    state.issues.push({
      id: issueId,
      slotId,
      component: componentKey,
      issue: description,
      status: component.badge,
      open: true,
      createdAt: todayISO(),
      log: [{
        date: todayISO(),
        technician: technician || '—',
        issue: description,
        resolutionStatus: 'Pending'
      }]
    });

    addNotification(
      'fault',
      'Fault reported at Spot ' + slotId + ' — ' + component.name
    );

    persist();
    return issueId;
  }

  function getIssues() {
    return state.issues.slice().sort((a, b) =>
      b.createdAt > a.createdAt ? 1 : -1
    );
  }

  /* 8. Reservation management */

  function _overlaps(a, b) {
    if (
      String(a.slot) !== String(b.slot) ||
      a.date !== b.date
    ) {
      return false;
    }

    const toMinutes = time => {
      const parts = time.split(':').map(Number);
      return parts[0] * 60 + parts[1];
    };

    const aStart = toMinutes(a.start);
    const aEnd = aStart + Number(a.duration) * 60;
    const bStart = toMinutes(b.start);
    const bEnd = bStart + Number(b.duration) * 60;

    return aStart < bEnd && bStart < aEnd;
  }

  function createReservation(data) {
    const slotId = String(data.slot);
    const slot = getSlot(slotId);

    if (!slot) {
      return { ok: false, message: 'Spot not found' };
    }

    if (slot.status !== 'available') {
      return {
        ok: false,
        message: 'Spot ' + slotId + ' is ' + slot.status
      };
    }

    const candidate = Object.assign({}, data, { slot: slotId });

    const clash = state.reservations.some(r =>
      r.status !== 'cancelled' &&
      r.status !== 'completed' &&
      _overlaps(r, candidate)
    );

    if (clash) {
      return {
        ok: false,
        message: 'That spot is already booked for the chosen time'
      };
    }

    const id = 'RES-' + Math.floor(1000 + Math.random() * 9000);

    const reservation = Object.assign(
      {
        id,
        status: 'pending',
        createdAt: iso(new Date())
      },
      data,
      { slot: slotId }
    );

    state.reservations.unshift(reservation);

    addNotification(
      'reservation',
      'New reservation ' + id + ' — Spot ' + slotId + ' awaiting approval'
    );

    persist();
    syncLiveReservations();

    return { ok: true, reservation };
  }

  function _findRes(id) {
    return state.reservations.find(r => r.id === id);
  }

  function approveReservation(id) {
    const reservation = _findRes(id);

    if (!reservation || reservation.status !== 'pending') {
      return null;
    }

    const slot = getSlot(reservation.slot);

    if (!slot || slot.status === 'maintenance') {
      return { error: 'Spot is under maintenance — cannot approve' };
    }

    const clash = state.reservations.some(r =>
      r.id !== reservation.id &&
      r.status === 'approved' &&
      _overlaps(r, reservation)
    );

    if (clash) {
      return { error: 'Another approved reservation conflicts with this booking' };
    }

    reservation.status = 'approved';

    addNotification(
      'reservation',
      reservation.id + ' approved — Spot ' + reservation.slot +
      ', ' + fmtDate(reservation.date) + ' ' + fmtTime(reservation.start)
    );

    persist();
    syncLiveReservations();

    return reservation;
  }

  function cancelReservation(id, actor) {
    const reservation = _findRes(id);

    if (
      !reservation ||
      reservation.status === 'completed' ||
      reservation.status === 'cancelled'
    ) {
      return null;
    }

    reservation.status = 'cancelled';

    addNotification(
      'reservation',
      reservation.id + ' cancelled' +
      (actor === 'admin' ? ' by administrator' : ' by user') +
      ' — Spot ' + reservation.slot
    );

    persist();
    syncLiveReservations();

    return reservation;
  }

  function completeReservation(id) {
    const reservation = _findRes(id);

    if (
      !reservation ||
      reservation.status === 'completed' ||
      reservation.status === 'cancelled'
    ) {
      return null;
    }

    reservation.status = 'completed';

    addNotification(
      'reservation',
      reservation.id + ' completed — Spot ' + reservation.slot
    );

    persist();
    syncLiveReservations();

    return reservation;
  }

  function updateReservation(id, patch) {
    const reservation = _findRes(id);

    if (
      !reservation ||
      reservation.status === 'completed' ||
      reservation.status === 'cancelled'
    ) {
      return null;
    }

    const candidate = Object.assign({}, reservation, patch);

    if (candidate.slot !== undefined) {
      candidate.slot = String(candidate.slot);
    }

    const clash = state.reservations.some(r =>
      r.id !== id &&
      r.status !== 'cancelled' &&
      r.status !== 'completed' &&
      _overlaps(r, candidate)
    );

    if (clash) {
      return {
        error: 'Conflicts with another reservation on that spot/time'
      };
    }

    Object.assign(reservation, patch);

    if (reservation.slot !== undefined) {
      reservation.slot = String(reservation.slot);
    }

    persist();
    syncLiveReservations();

    return reservation;
  }

  function getReservations(filter) {
    let list = state.reservations
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date));

    if (!filter) {
      return list;
    }

    if (filter.q) {
      const query = filter.q.toLowerCase();

      list = list.filter(r =>
        [r.id, r.name, r.vehicle, r.phone, r.slot]
          .join(' ')
          .toLowerCase()
          .includes(query)
      );
    }

    if (filter.slot) {
      list = list.filter(r => String(r.slot) === String(filter.slot));
    }

    if (filter.date) {
      list = list.filter(r => r.date === filter.date);
    }

    if (filter.status) {
      list = list.filter(r => r.status === filter.status);
    }

    if (filter.floor) {
      list = list.filter(r => r.floor === filter.floor);
    }

    return list;
  }

  function getUserReservations(phone) {
    if (!phone) {
      return [];
    }

    return state.reservations
      .filter(r =>
        r.phone === phone ||
        (state.session && r.phone === state.session.phone)
      )
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  function canUserCancel(reservation) {
    if (
      !reservation ||
      !['pending', 'approved'].includes(reservation.status)
    ) {
      return false;
    }

    const start = new Date(
      reservation.date + 'T' + reservation.start + ':00'
    );

    return new Date() < start;
  }

  /* 9. Notifications */

  function addNotification(type, message) {
    state.notifications.unshift({
      id: 'NTF-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      type,
      message,
      time: todayISO(),
      read: false
    });

    state.notifications = state.notifications.slice(0, 30);
  }

  function getNotifications() {
    return state.notifications.slice();
  }

  function markNotificationsRead() {
    state.notifications.forEach(n => {
      n.read = true;
    });

    persist();
  }

  // ---------- ACCOUNTS ----------

  function signup(data) {
    data = data || {};

    if (state.users.some(function (u) {
      return u.phone === data.phone;
    })) {
      return {
        ok: false,
        message: 'An account with this phone number already exists'
      };
    }

    state.users.push(Object.assign({
      password: 'user123'
    }, data));

    state.session = {
      name: data.name,
      phone: data.phone,
      email: data.email || ''
    };

    persist();
    return { ok: true };
  }

  function userLogin(phone, password) {
    var user = state.users.find(function (u) {
      return u.phone === phone && u.password === password;
    });

    if (!user) {
      return {
        ok: false,
        message: 'Invalid credentials'
      };
    }

    state.session = {
      name: user.name,
      phone: user.phone,
      email: user.email || ''
    };

    persist();
    return { ok: true };
  }

  function getUserSession() {
    return state.session;
  }

  function setGuestSession(name, phone) {
    state.session = {
      name: name,
      phone: phone,
      email: ''
    };

    persist();
  }

  function userLogout() {
    state.session = null;
    persist();
  }

  function adminLogin(user, pass) {
    if (user === ADMIN_USER && pass === ADMIN_PASS) {
      state.adminSession = true;
      persist();
      return { ok: true };
    }

    return {
      ok: false,
      message: 'Invalid administrator credentials'
    };
  }

  function isAdmin() {
    return !!state.adminSession;
  }

  function adminLogout() {
    state.adminSession = false;
    persist();
  }

  // ---------- ANALYTICS ----------

  function reservationsPerDay(days) {
    var output = [];

    for (var i = days - 1; i >= 0; i--) {
      var date = daysFromNow(-i);

      output.push({
        date: date,
        count: state.reservations.filter(function (r) {
          return r.date === date;
        }).length
      });
    }

    return output;
  }

  function mostReservedSlots(limit) {
    var counts = {};

    state.reservations
      .filter(function (r) {
        return r.status === 'approved' ||
               r.status === 'completed';
      })
      .forEach(function (r) {
        counts[String(r.slot)] =
          (counts[String(r.slot)] || 0) + 1;
      });

    return SLOT_META
      .map(function (slot) {
        return {
          slot: slot.id,
          count: counts[String(slot.id)] || 0
        };
      })
      .sort(function (a, b) {
        return b.count - a.count;
      })
      .slice(0, limit || 8);
  }

  function maintenanceFrequency() {
    var counts = {};

    state.issues.forEach(function (issue) {
      var component = COMPONENTS.find(function (c) {
        return c.key === issue.component;
      });

      var label = component
        ? component.name
        : issue.component;

      counts[label] = (counts[label] || 0) + 1;
    });

    return Object.keys(counts).map(function (label) {
      return {
        label: label,
        count: counts[label]
      };
    });
  }

  function occupancySeries(days) {
    return reservationsPerDay(days).map(function (day) {
      var dayNumber = parseInt(day.date.slice(8, 10), 10);

      return {
        date: day.date,
        pct: Math.min(
          96,
          Math.round(30 + day.count * 8 + dayNumber % 15)
        )
      };
    });
  }

  // ---------- RESET AND RAW STATE ----------

  function resetDemo() {
    localStorage.removeItem(STORAGE_KEY);
    state = defaultState();
    seed();
    persist();

    liveSlots = {};
    liveReservationSignatures = {};

    syncLiveReservations();
  }

  function raw() {
    return state;
  }

  // ---------- PUBLIC API ----------

  window.EasyPark = {
    SLOT_META: SLOT_META,
    COMPONENTS: COMPONENTS,
    MAINT_STATES: MAINT_STATES,
    RES_STATUSES: RES_STATUSES,
    SLOT_STATUSES: SLOT_STATUSES,

    todayISO: todayISO,
    daysFromNow: daysFromNow,
    fmtDate: fmtDate,
    fmtTime: fmtTime,

    computeSlots: computeSlots,
    getSlots: getSlots,
    getSlot: getSlot,
    getStats: getStats,
    togglePresence: togglePresence,

    setComponentHealth: setComponentHealth,
    setIssueStatus: setIssueStatus,
    addIssueLog: addIssueLog,
    getIssues: getIssues,
    reportIssue: reportIssue,

    createReservation: createReservation,
    approveReservation: approveReservation,
    cancelReservation: cancelReservation,
    completeReservation: completeReservation,
    updateReservation: updateReservation,
    getReservations: getReservations,
    getUserReservations: getUserReservations,
    canUserCancel: canUserCancel,

    getNotifications: getNotifications,
    markNotificationsRead: markNotificationsRead,

    signup: signup,
    userLogin: userLogin,
    getUserSession: getUserSession,
    setGuestSession: setGuestSession,
    userLogout: userLogout,

    adminLogin: adminLogin,
    isAdmin: isAdmin,
    adminLogout: adminLogout,

    reservationsPerDay: reservationsPerDay,
    mostReservedSlots: mostReservedSlots,
    maintenanceFrequency: maintenanceFrequency,
    occupancySeries: occupancySeries,

    resetDemo: resetDemo,
    raw: raw
  };

  // ---------- STARTUP ----------

  load();

  pollRealSensors();
  setInterval(pollRealSensors, 3000);

  syncLiveReservations();
  setInterval(syncLiveReservations, 10000);

})();
