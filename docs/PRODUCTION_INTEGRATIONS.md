# Optional production integrations

No provider listed here is required for local demonstrations. Never copy server credentials into `NEXT_PUBLIC_*` or `EXPO_PUBLIC_*`. Configuration defaults to cash, local route estimates, in-app updates and Supabase email/password authentication.

| Type | Current implementation / boundary | Future environment names (proposed, not currently consumed) | Affected modules |
| --- | --- | --- | --- |
| Maps and routes | `RouteProvider` / `LocalRouteProvider`: local search/reference points, manual coordinates, Haversine estimate, configurable speed, unknown tolls. Financial quote remains SQL. | `ROUTE_PROVIDER=google|mapbox`, server-only `GOOGLE_ROUTES_API_KEY` or `MAPBOX_ACCESS_TOKEN`; keep unset now | `packages/core/src/routes.ts`, passenger LocationField/booking, web BookingPlanner, SQL fare adapter |
| Payments | `PaymentProvider` / `MockPaymentProvider` simulate only explicitly enabled demo events; `record_mock_payment_event` validates actor/flags/transitions and durable idempotency. Cash creates pending record. | `PAYMENT_PROVIDER`, `PAYMENT_SECRET_KEY`, `PAYMENT_WEBHOOK_SECRET` | `packages/core/src/providers.ts`, admin operation actions, payments/payment_events migrations |
| Push notifications | `NotificationProvider` interface; local delivery is SQL-created `notifications` plus Supabase Realtime and refresh/polling. No external push transport is enabled. | `PUSH_PROVIDER`, `EXPO_ACCESS_TOKEN` or provider server credential | `packages/core/src/providers.ts`, notifications table, mobile resource/realtime subscriptions |
| SMS | No SMS dependency; email/password Auth is the supported path. Add an OTP/SMS adapter through Supabase Auth before exposing a phone sign-in UI. | `SMS_PROVIDER`, `SMS_API_KEY`, `SMS_SENDER_ID` | Supabase Auth configuration; shared mobile AuthProvider and web auth actions |
| Analytics | `AnalyticsProvider` boundary; immutable domain/dispatch/audit/referral events and basic operations summaries are the local record. No arbitrary browser event collector is enabled. | `ANALYTICS_PROVIDER`, provider-specific server key only if required | `packages/core/src/providers.ts`, admin operations and audit/referral migrations |
| Crash reporting | `CrashReporter` / local console reporter plus normal web/Expo logs and error states. Third-party transport remains unconfigured. | `CRASH_REPORTER`, `CRASH_REPORT_DSN` | `packages/core/src/providers.ts`, web error boundaries, mobile resource errors |

## Routes and money

The local provider does not claim a navigable road path, live traffic, authoritative tolls or guaranteed travel time. Avoid-tolls and preferred-route choices record intent; unknown tolls remain null. A production route provider should return provenance and expiry and be invoked server-side for chargeable quotes. Do not let a browser/mobile provider choose fare, discounts, commission or earnings. The database snapshots financial values at booking so later admin commission changes do not retroactively change accepted jobs.

The default 0% commission is configured in `app_config`; B2B prices live in `subscription_plans`. Null plan prices mean quote required, not zero. Subscription activation/renewal/cancellation are manual. Do not imply a payment collector, worker or automatic backup scheduler exists.

## Payments

Ordinary production must not use MockPaymentProvider. An explicitly designated demo deployment additionally requires trusted server `HATIDONE_DEMO_MODE=true` plus database `demo_mode` and `mock_payment_enabled`. Keep all three off for a real launch. Mobile/browser user roles cannot invoke payment mutations. The current mock RPC also allows trusted operations so local SQL tests and demos can run; an administrator who can enable database demo flags is intentionally privileged.

A real provider needs a server checkout/event adapter and a webhook route that verifies the raw-body signature before recording a globally unique event ID transactionally. Refunds and amounts must come from the server ledger. No unsigned webhook endpoint exists in this sprint. The interface should be expanded for real checkout semantics when a provider is selected; `simulate` is explicitly a demo capability.

## Partner handoff

Generic booking intent URL:

```text
/book?partner_id=<organization-uuid>&external_reference=DEMO-RES-001&pickup=<encoded-address>&destination=<encoded-address>&destination_latitude=13.76&destination_longitude=121.05&scheduled_at=<ISO-time>&guest_count=2&service_type=transfer
```

Web also accepts destination_lat/destination_lng aliases; mobile handoff uses those short names. Known service location IDs such as `naia` and `tagaytay` may replace address text in web corridor links. Authentication return paths are local-only. Every submitted partner/account ID is validated in SQL. External references provide attribution, never authorization. Public links expose no realtime location. No PrivateResortPH dependency or credentials are embedded.

## Feature limits and flags

Foreground GPS only. No background tracking task is registered. App config centralizes commission, radius, offer timeout, confirmation window, backup enablement, route speed, mock payment/notification flags and matching weights. Real Google/Mapbox/payment/push/SMS adapters are absent and their UI is unavailable until deliberately implemented/configured. Some future environment names above are design contracts, not magic switches that activate an unimplemented service.

## Deployment preparation

Validate service corridors, fare assumptions, transport/insurance permissions, privacy/retention practices and operating procedures with appropriate local advisers before real passenger operations. This sprint encodes no claim of regulatory approval. Resolve dependency advisories and device/build validation described in the completion report. Reconcile historical migration versions before any hosted deployment; never run local fixture seed against production.
