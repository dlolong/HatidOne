# Credential-free demo scenarios

Run the [startup commands](SOLO_DEVELOPER_RUNBOOK.md). All accounts below use the local-only password `DEMO-ONLY-HatidOne!42`. Use separate browser profiles/incognito windows or the two mobile apps. Do not use these identities outside the local fixture environment.

| Role | Email |
| --- | --- |
| Passenger | passenger@hatidone.test |
| Verified driver | driver@hatidone.test |
| Pending driver | pending-driver@hatidone.test |
| Backup driver | backup-driver@hatidone.test |
| Admin | admin@hatidone.test |
| Fleet owner | fleet@hatidone.test |
| Resort partner | partner@hatidone.test |
| Corporate manager | corporate@hatidone.test |
| Employee | rider@hatidone.test |
| Unrelated passenger | outsider@hatidone.test |

Reset with `npm run demo:reset` to restore fixtures and move relative schedules into the future. Reference IDs in seeded fixtures: passenger user ends `000001`, verified driver profile `20000000-0000-4000-8000-000000000002`, vehicle `30000000-0000-4000-8000-000000000002`, backup driver/vehicle end `000009`.

## 1. Passenger books a scheduled resort transfer

1. Sign in as passenger on web `/book` or the passenger app Home → Book.
2. Select NAIA reference pickup and Tagaytay destination. Add the exact lobby/entrance text without treating the reference point as verified navigation.
3. Select a pickup at least 30 minutes ahead (tomorrow is convenient), transfer service, 2 passengers, sedan, and Fastest or Avoid tolls.
4. Preview the server fare. Local straight-line distance/duration and unknown tolls are labeled.
5. Confirm. The status is requested until operations offers/assigns a driver. Repeated submission with the same form request ID creates one ride.

## 2. Driver receives and accepts a job

1. In admin web `/admin/dispatch`, choose the request from scenario 1, search eligible drivers, and create offers. The seeded driver is verified and near Manila; if needed increase the permitted search radius for the demo.
2. In Driver Jobs, sign in as `driver@hatidone.test`. Update GPS or enter Manila reference coordinates in Account, and select Available.
3. Review pickup, destination, schedule, gross fare, commission and estimated driver earnings before Accept. An offer can also be declined.
4. Open Trips → the assigned trip → confirm scheduled assignment. At pickup use heading → arrived. Passenger Booking detail displays the six-digit PIN; enter it to start and then complete the trip. Wrong PIN cannot start it.
5. Earnings shows the completed server fare snapshot. No online money movement occurs.

The seeded offer for ride `40000000-0000-4000-8000-000000000001` can be accepted immediately without creating another request. Do not overlap its schedule with another demo assignment.

## 3. Going Home

1. Driver Account → Going Home: choose a Manila destination/reference coordinates `14.60, 121.00`, a departure time before the matching ride, and enable.
2. Use a Batangas-to-Manila request (scenario 4 seed is suitable), scheduled after the departure time.
3. Operations creates an eligible offer. Jobs → Going Home shows “Trips going your way” with explainable match reasons. A destination pointing away from home is not flagged.
4. Disable Going Home and reload: the persisted preference and suggestion change. No AI or route API is used.

## 4. Return ride suggestion

1. Seeded outbound assignment: `40000000-0000-4000-8000-000000000002`, Manila → Batangas, about 48 hours after reset.
2. Return candidate: `40000000-0000-4000-8000-000000000004`, Batangas → Manila, about 54 hours after reset.
3. Admin Dispatch → select return candidate → create offers. Eligibility can use the accepted outbound destination after its expected end plus buffer, even when the driver’s current GPS is in Manila.
4. Driver Jobs → Return Matches. Pickup is near the outbound destination and starts after the buffer. Overlapping rides are excluded and acceptance rechecks the schedule in SQL.

## 5. Fleet manual dispatch

1. Sign in as `fleet@hatidone.test`; Fleet → open Fictional Sunrise Demo Fleet. Drivers/vehicles are already linked in seed.
2. Request transport within this fleet account using reference coordinates `14.55,121.05` → `13.76,121.05`, a nonconflicting future schedule, sedan and 2 passengers.
3. Copy the booking ID from the schedule. Fleet drivers and vehicles → Manually dispatch → choose verified driver and linked sedan → Assign.
4. The driver sees the assignment. The fleet cannot dispatch another company’s private booking or an unrelated passenger booking; operations handles those.
5. Review schedule, completed estimate summary and Subscription. The calendar is a chronological schedule table, not a drag/drop calendar.

## 6. Resort partner guest transport

1. Sign in as `partner@hatidone.test`; Business → Fictional Bay Demo Resort.
2. Add a saved location, e.g. fictional lobby at `13.76,121.05`.
3. Request transport with the reservation reference `DEMO-RES-001`. The manager is the rider of record unless an authorized registered rider is specified through corporate tools.
4. Copy Guest booking link. A separate passenger follows it, signs in, books, and the partner’s Referred guest bookings shows a sanitized schedule/status projection.
5. The URL can be encoded by any QR tool; no QR service credentials are needed. A partner link does not grant access to profiles, PINs, chat or realtime location.

## 7. Corporate employee ride

1. Sign in as `corporate@hatidone.test`; Business → Fictional Acme Demo Company.
2. Members already includes `rider@hatidone.test`. Add/update a registered member by exact email; set rider access.
3. Copy the employee UUID from the visible member record into Authorized employee user ID on the transport form. Use purpose/cost center `Demo sales airport visit`.
4. Request a future ride. The employee signs in to the passenger app and sees it in Bookings.
5. Corporate schedule and monthly planning summary show the authorized company ride. The unrelated demo user cannot read it. Billing remains manual.

## 8. Admin activates a business subscription

1. Admin → Operations → Subscriptions → Activate/extend/change.
2. Select Fictional Bay Demo Resort, partner Business plan, active, a future expiration and manual billing status.
3. Save; resort Subscription shows the plan, features, billing and expiration. A past expiration is displayed as expired even without a background worker.
4. Extend or cancel manually. Audit records capture the action. No recurring payment is initiated.

## 9. Demo payment

1. Use only the local seeded database. `demo:env` writes web `HATIDONE_DEMO_MODE=true`; seed enables database demo and mock-payment flags.
2. Admin Operations → Demo payment. The form says **DEMO PAYMENT**.
3. Use a booking without an existing cash payment, choose pending then paid (submit the refreshed form for a new event ID), then refunded.
4. No funds move. Duplicate event IDs are idempotent; conflicting replays and invalid transitions fail. Drivers/passengers cannot set payment status.
5. Disable the web demo flag and restart: the form disappears and the server action refuses simulation. Ordinary production without explicit demo configuration fails closed.

## 10. Driver verification and expiry

1. Sign in as `pending-driver@hatidone.test`; Driver Account → web onboarding. Save profile/phone, vehicle details, and upload **fictional test documents** with future expiration dates. Submit for review.
2. Admin Operations → Driver verification → Review private documents. Open signed links and approve or reject with a reason.
3. The driver stays offline until selecting Available after approval. Expired mandatory documents prevent eligibility and approval.
4. To exercise expiry without waiting, use the disposable SQL test suite (`npm run test:db`), which expires a fixture license and proves offer acceptance fails. Avoid dashboard-only changes to a hosted schema.
5. Existing seeded verified documents contain metadata only, not downloadable files. Use uploaded fictional documents to test the complete Storage download/review path.

## Validation boundary

These are runnable scenarios backed by implemented UI/RPCs, not a claim that every device flow was manually completed. See FINAL_COMPLETION_REPORT for executed builds, real SQL tests, browser checks and unresolved setup/runtime limits.
