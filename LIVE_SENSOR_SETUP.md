# EasyPark live Slot 101 integration

Keep the existing frontend on GitHub Pages if desired. Deploy `server.js` as the small Render API.

## Live behavior
- ESP32 POSTs Slot 101 occupancy to `/api/slots/101/presence`.
- ESP32 GETs `/api/slots/101/status` every second to learn whether Slot 101 is reserved.
- Webpage GETs `/api/slots/101/status` every second.
- Webpage POSTs `/api/slots/101/reservation` whenever Slot 101 reservation state changes.
- Reservation takes priority for the physical LED/TFT: blue = reserved, red = occupied, green = available.

## Frontend
In `js/db.js`, replace `YOUR-EASYPARK-API.onrender.com` with the actual Render API hostname.
