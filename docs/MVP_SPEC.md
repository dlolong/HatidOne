# HatidOne MVP Specification

## Product wedge
Scheduled rides, airport/resort transfers, local point-to-point transport, and fleet dispatch.

## Roles
- Passenger
- Driver
- Fleet Admin
- Admin / Support

## Core state machine
`draft -> requested -> searching -> offered -> assigned -> driver_en_route -> driver_arrived -> trip_started -> trip_completed`

Terminal/exception states:
- passenger_cancelled
- driver_cancelled
- operator_cancelled
- expired
- no_driver_found
- no_show

## MVP acceptance criteria
### Passenger
- Can authenticate.
- Can create a scheduled ride request.
- Can select pickup/dropoff and vehicle type.
- Can view estimated fare returned by trusted server logic.
- Can view assignment and trip status.

### Driver
- Can submit onboarding details and vehicle information.
- Can only receive offers when verified and eligible.
- Can accept/decline offers.
- Cannot modify fare or payment state.

### Fleet
- Can manage its own drivers/vehicles.
- Can view its own bookings.
- Can manually dispatch eligible drivers.

### Admin
- Can review drivers/fleets/vehicles.
- Can manually assign rides.
- Can inspect trip events and payment events.

## Non-functional requirements
- Mobile-first UX
- RLS enabled
- Idempotent payment handlers
- Audit events for critical trip/payment changes
- Server-side authorization for privileged mutations
- PostGIS for driver proximity and service-area logic
