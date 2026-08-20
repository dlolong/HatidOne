# Codex Task — Sprint 04 Dispatch

Read `AGENTS.md` first.

Implement a deterministic dispatch MVP.

Required functions:
- findEligibleDrivers
- createRideOffers
- expireRideOffers
- acceptRideOffer
- manualAssignRide

Eligibility:
- verified driver
- active account
- online
- compatible active verified vehicle
- within configurable radius

Use PostGIS for proximity.

Critical requirement:
Use a transaction / locking strategy so two drivers cannot both win the same ride.
Add tests for concurrent acceptance and passenger cancellation races.
