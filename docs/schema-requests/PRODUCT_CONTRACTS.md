# Product sprint API contracts

All RPCs are PostgreSQL `SECURITY DEFINER` with explicit auth checks and empty search paths. Clients use their normal Supabase JWT. Tables are SELECT-only with RLS unless noted. No service key belongs in mobile/browser code.

## Booking and jobs

`create_transport_request(p_payload jsonb) -> uuid` accepts snake-case keys:
`client_request_id` (UUID), `pickup_address`, `pickup_lat`, `pickup_lng`, `dropoff_address`, `dropoff_lat`, `dropoff_lng`, `scheduled_at` (ISO), `vehicle_type` (sedan/suv/van/motorcycle), `passenger_notes`, `passenger_count`, `service_type` (scheduled/transfer/local/instant), `route_preference` (fastest/cheapest/avoid_tolls/preferred_route), optional `organization_id`, `passenger_id`, `ride_purpose`, `external_reference`, `partner_id`.

Passenger identity defaults to caller. Organization bookings require active manager/owner membership; alternate rider must be an active registered organization member. Partner link attribution does not create organization membership. Scheduled/transfer requests require 30 minutes–180 days lead time. Fare, distance and duration are recomputed in SQL; client financial fields are ignored. Route choice is recorded as preference: local straight-line estimate cannot prove a cheapest/toll-free route. Tolls remain unknown (`NULL`).

The existing `create_scheduled_ride_request(...)`, `accept_ride_offer(p_offer_id)`, `cancel_own_ride_request(p_ride_request_id)` remain. New `decline_ride_offer(p_offer_id) -> void`.

`ride_requests` SELECT adds `passenger_count`, `organization_id`, `partner_id`, `ride_purpose`, `external_reference`, `pickup_latitude`, `pickup_longitude`, `dropoff_latitude`, `dropoff_longitude`, `route_source` (`local_estimate`), `route_preference`, `estimated_toll_amount` (nullable unknown), `gross_fare`, `commission_percent`, `platform_commission`, `driver_earnings`. Fare snapshot is immutable to clients and used at completion. `app_config.driver_commission_percent` defaults 0.

Use direct RLS SELECT on `ride_offers`, followed by `ride_requests` IDs. Offers include vehicle/distance/expiry. Never SELECT driver location for offer previews.

## Driver

`save_driver_preferences(p_payload jsonb) -> void`: `service_types` string[] from existing service types; `preferred_areas`/`destination_areas` string[]; `going_home_enabled`; `home_address`; `home_latitude`, `home_longitude`; `going_home_departure` ISO. Fields stored in `driver_preferences` keyed `driver_id`. Going Home requires coordinates and departure. Preference home location is visible only to owner and operations.

`publish_driver_location(p_latitude,p_longitude) -> void` preserves online flag.
`set_driver_availability(p_online,p_latitude,p_longitude)` retained.
`confirm_ride_assignment(p_ride_request_id) -> void` sets `ride_assignments.confirmed_at` once.

`advance_trip(p_ride_request_id,p_action,p_pin default null) -> ride_status` actions: heading, arrived, start, complete, cancel, no_show. Start requires passenger PIN. **Wrong PIN returns unchanged `driver_arrived`** so failed-attempt updates commit. UI must only report start success when result is `trip_started`. Five failures lock for 15 minutes. Unauthorized/locked/state failures raise errors. Completion replay returns completed without another payment. Fare cannot be supplied by caller.

`trips`: explicitly select `id,ride_request_id,driver_id,passenger_id,vehicle_id,started_at,completed_at,actual_distance_meters,actual_duration_seconds,final_fare,created_at,gross_fare,platform_commission,driver_earnings`. Do NOT SELECT `*`: `trip_pin_hash` has no client SELECT grant.

## Passenger, communication and safety

`get_passenger_trip_pin(p_ride_request_id) -> text` only booking passenger before start.
`get_assigned_driver(p_ride_request_id) -> jsonb`: driver_id,name,verification_status,rating,rating_count,vehicle_type,brand,model,color,plate_number,capacity. No unrelated contact/location fields.

`send_ride_message(p_ride_request_id,p_body,p_client_message_id UUID) -> uuid` is idempotent. `ride_messages`: id,ride_request_id,sender_user_id,body,client_message_id,created_at. Only assigned participants and operations can read. `mark_ride_messages_read(p_ride_request_id)` updates `ride_message_reads(ride_request_id,user_id,last_read_at)`.

`notifications`: id,user_id,title,body,ride_request_id,read_at,created_at. `mark_notification_read(p_notification_id)` is owner-only. Realtime publication includes requests/offers/assignments/messages/notifications where publication exists.

`report_ride_safety(p_ride_request_id,p_category,p_details) -> uuid`; category safety/driver/vehicle/payment/other. `safety_reports` includes reporter_user_id,status open/reviewing/resolved. `admin_resolve_safety_report(p_report_id,p_status,p_note)` is operations-only and audited.

`emergency_contacts`: id,user_id,name,phone,created_at. `save_emergency_contact(p_name,p_phone,p_contact_id default null) -> uuid`, `delete_emergency_contact(p_contact_id)`; up to five per user.

## Organizations

`organizations`: id,kind (fleet/partner/corporate),name,owner_user_id,partner_type (resort/hotel/travel_agent/transport_operator/corporate/other),external_reference,fleet_id,created_at,updated_at. Creating fleet organization also creates linked existing `fleets` record, without changing platform role.
`create_organization(p_payload {name,kind,partner_type?,external_reference?}) -> uuid`.
`organization_members`: id,organization_id,user_id,member_role owner/manager/rider,status active/inactive,created_at,updated_at.
`save_organization_member(p_payload {organization_id,user_id? or email?,member_role,status}) -> uuid`; requires manager/admin, cannot change owner. Email lookup is exact, active registered account only.
`organization_locations`: id,organization_id,label,address,latitude,longitude,created_at.
`save_organization_location(p_payload {organization_id,label,address,latitude,longitude}) -> uuid`.
`get_fleet_resources(p_organization_id) -> {vehicles:[],drivers:[]}` sanitized projections. `admin_link_fleet_vehicle(p_organization_id,p_vehicle_id)` audited operations-only.

## Operations and monetization

`app_config` singleton `id=true`: driver_commission_percent, demo_mode, confirmation_minutes, matching_weights, default_matching_radius_km,offer_timeout_seconds,scheduled_confirmation_hours,backup_driver_enabled,mock_route_speed_kph,mock_payment_enabled,mock_notifications_enabled,updated_at.
`admin_update_config(p_payload)` admin-only, updates supplied recognized values.

`subscription_plans`: id,audience,display_name,features jsonb string array,monthly_price_php nullable (quote required),active. IDs: fleet_free/fleet_starter/fleet_business/fleet_enterprise/partner_starter/partner_business/corporate_business/corporate_enterprise.
`organization_subscriptions`: id,organization_id,plan_id,status (trial/active/past_due/cancelled/expired),starts_at,expires_at,billing_status manual_due/settled/waived,updated_at. Display expiry based on timestamp even without background worker.
`admin_manage_subscription(p_payload {organization_id,plan_id,status,expires_at,billing_status}) -> uuid` admin-only.

`admin_review_driver(p_driver_id,p_decision,p_reason default null)` decisions verified/rejected/suspended. Verifying requires valid license/registration and owned storage objects, reviews mandatory documents together, requires a primary vehicle. Driver is offline after review.
`admin_set_backup_driver(p_ride_request_id,p_driver_id,p_vehicle_id) -> uuid`; `backup_assignments`: id,ride_request_id,driver_id,vehicle_id,status ready/activated/cancelled,created_at. `admin_activate_backup(p_ride_request_id) -> assignment uuid` only before primary heads to pickup; rotates PIN and revalidates driver eligibility. Manual trigger only, no scheduler.

`create_referral_code(p_referral_type,p_organization_id default null) -> uuid`; `referral_codes`: id,owner_user_id,organization_id,code,referral_type,created_at. `redeem_referral_code(p_code) -> uuid` signup attribution once, no self-referral. `admin_review_referral(p_referral_code_id,p_referred_user_id,p_status,p_note)` adds immutable qualified_activity/reward_pending/reward_approved/reward_rejected event. No money moves.

`record_mock_payment_event(p_ride_request_id,p_event_id TEXT,p_status) -> payment uuid`; admin/service-role only, requires BOTH demo_mode and mock_payment_enabled. Status pending/paid/failed/refunded, server amount, globally unique idempotency event ID. Production server provider adapter must additionally forbid this unless explicit demo mode. `payments` and immutable `payment_events` store mock labeling. Never invoke with a browser-provided service key.

`audit_events`: id,actor_user_id,action,entity_type,entity_id,metadata,created_at; operations reads, no client writes.

## Additional completed contracts

`request_driver_application() -> void` explicitly converts an active passenger with no active passenger rides to a pending/offline driver. Existing drivers are idempotent. This grants no operations or verification privilege.

`get_partner_referrals(p_organization_id) -> jsonb[]` provides exact-partner manager/operations-only sanitized referral rows (`id,status,scheduled_at,pickup_address,dropoff_address,passenger_count,external_reference,created_at`). It does not reveal profile or driver location data.

`get_driver_reliability(p_driver_id) -> jsonb` is owner/operations-only: `completed,cancelled,noShows,onTime,arrivalSamples,driverNoShowTrackingAvailable`. `noShows` is zero and tracking availability false: booking `no_show` is passenger absence and must never penalize driver reliability. Completion/cancellation and arrival counts are derived from actual booking/event records.

Fleet dispatch is deliberately scoped: non-operations callers must own the fleet linked to the ride's exact organization and have active manager membership. Creating a fleet never grants access to unrelated passenger, corporate or other fleet bookings.

Candidate distance uses the nearer of current location or an accepted outbound destination when expected end + 30 minutes precedes the candidate (maximum eight-hour return window). Schedule conflicts use one 30-minute buffer, not two. Backup activation rechecks conflicts. Starting a new trip is blocked while another trip for that driver or vehicle is still in progress, even when the previous estimate ended earlier.

No-show requires ten minutes after the later of the schedule and actual arrival event. Existing active assignments are backfilled with isolated PINs and trip rows during migration.

## Validation and local fixtures

Run `sh supabase/tests/run-local.sh`. Requires Docker and Python 3; no npm dependencies or external credentials. It creates a dedicated disposable Supabase PostgreSQL 17 container and template0 database, applies every historical migration in filename order (including both historical 0004 names), runs fictional seed, exercises SQL grants/RLS/business assertions, then executes real concurrent transactions for same-driver conflicting acceptance, two-driver acceptance, and cancellation-versus-acceptance. Its auth/storage bootstrap belongs only to the SQL harness; use the real local Supabase stack for HTTP/Auth/Storage testing.

`supabase/seed.sql` is local only and explicitly enables demo configuration. All users use `DEMO-ONLY-HatidOne!42`; accounts: passenger, driver, pending-driver, admin, fleet, partner, corporate, rider, backup-driver, outsider at `@hatidone.test`. Fictional document metadata is seeded without claiming actual reviewed documents or uploading bytes. Replace demo metadata with real private document uploads when testing storage downloads. Do not run seed against production.

The config uses local ports 55321 API, 55322 PostgreSQL, 55323 Studio, 55324 email. Preserve historical migration files; local CLI staging may rename copied versions to accommodate duplicate legacy 0004 migration numbers. Never deploy that staging history to an existing remote project.

Migration `0008_configured_matching.sql` consumes `mock_route_speed_kph` for the server local duration estimate and uses configured matching weights to order dispatch candidates. Scoring factors are effective pickup distance, service/area preferences, Going Home direction and departure, return direction/timing, idle time, and observed completion/cancellation with a neutral prior for fewer than ten samples. No personal/protected traits enter the score. Weights must be numeric 0–1000. Onboarding vehicle and document RPCs serialize with driver review; direct vehicle metadata writes are revoked so callers cannot bypass the lock.
