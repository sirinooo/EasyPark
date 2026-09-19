# EasyPark live Slot 101 integration

Keep the existing frontend on GitHub Pages if desired. Deploy `server.js` as the small Render API.

## Live behavior
- ESP32 POSTs Slot 101 occupancy to `/api/slots/101/presence`.
- ESP32 GETs `/api/slots/101/status` every second to learn whether Slot 101 is reserved.
- Webpage GETs `/api/slots/101/status` every second.
- Webpage POSTs `/api/slots/101/reservation` with `startsAt` and `endsAt` for approved Slot 101 reservations.
- Physical priority: red = occupied, blue = reserved only when the slot is empty, green = available.

## Frontend
The Render API hostname is already set in `js/db.js` as `https://easypark-1yd1.onrender.com`.

- The Render API determines whether the reservation is currently active from `startsAt`/`endsAt`, so expiry does not depend on the ESP32 clock.
