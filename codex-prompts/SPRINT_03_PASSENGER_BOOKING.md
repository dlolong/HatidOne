# Codex Task — Sprint 03 Passenger Booking

Read `AGENTS.md` first.

Build the first scheduled passenger booking flow.

Pages:
- `/book`
- `/booking/[id]`
- `/history`

Fields:
- pickup address + lat/lng
- dropoff address + lat/lng
- scheduled date/time
- vehicle type
- passenger notes

Rules:
- Do not trust fare submitted by browser.
- Implement a server-side placeholder fare calculator behind a clear interface so regulated pricing can replace it later.
- Persist `ride_requests`.
- Allow passenger to read only their own bookings.
- Add status UI for draft/requested/searching/assigned/cancelled.
- Add mobile-first UI and validation.
