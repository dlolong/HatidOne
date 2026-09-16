# Admin workspace update

Implemented September 8, 2026. Changes are local and preserve the existing RC1 and registration work. No hosted settings or schema migrations were changed.

## Screens and behavior

- `/admin`: exact queue totals, active and upcoming ride counts, a separate count for assigned pickups whose scheduled time has passed, and direct links to review, dispatch, safety, business and system work. Passed pickup times are not labeled as no-shows.
- `/admin/drivers`: dedicated, searchable application queue with status filters and 25 applications per page. Pending drafts are excluded in the database before pagination. Stale page links recover to page one. Names and emails replace UUID-only summaries.
- `/admin/drivers/[id]`: applicant details, vehicle details, private documents, expiration/rejection notes and explicit review decisions. Approval blockers explain missing documents, account restrictions and active passenger bookings. Document links expire after five minutes. Saves remain on the reviewed application.
- `/admin/dispatch`: pickup times, quote-review links, offer loading states and clear empty/outcome messages. Offer outcomes preserve the ride and search radius and correctly label the RPC result as active offers, which can include pre-existing offers. Malformed assignment IDs, missing quote versions and invalid reasons are rejected before mutation. Assignment errors no longer incorrectly blame driver eligibility alone.
- `/admin/operations`: verification links to the full review queue; submitted application count is exact. Saves and errors return to the originating tab. Configuration rejects missing fields rather than converting them to zero. Subscription plans match the chosen business type and existing subscription settings are prefilled.
- `/account` and navigation: administrator identity and workspace links; passenger history and driver application links are shown only to passenger/driver roles. The existing deletion-request review flow remains available.
- Admin routes include a server authorization guard, loading screen and recoverable error screen. New cards, filters and document layouts adapt to mobile widths.

## Confirmed bugs addressed

The previous verification query limited the oldest 100 driver records before excluding drafts, allowing drafts and completed applications to hide submitted applications. Reviews offered a default approval without showing applicant or vehicle details. Action redirects discarded workspace context. Empty configuration fields became zero through `Number('')`. Subscription choices mixed incompatible audiences. Administrator menus offered passenger/driver journeys. Out-of-range application pages produced a PostgREST range error; the new queue now recovers.

## Validation

- Web unit/regression suite: 107 tests across 26 files, including draft-heavy queues, stale pagination, authorization before private reads/mutations, configuration validation and action redirects.
- Web lint, strict TypeScript and production build: passed (34 generated pages).
- Real local Chrome and Supabase checks: 62 passed. See [workspace results](qa/admin-workspace.json) and [action results](qa/admin-actions.json). These cover admin login, applicant search, document access, save outcomes, driver suspension/reinstatement, invalid configuration, quote gating and passenger denial.
- Responsive checks: overview, driver queue, driver detail, dispatch, operations and account at 360, 390, 430, 768 and 1440 pixels; operations tabs additionally checked at 360 and 1440 pixels. [Screenshots](screenshots/admin/overview-360.png) and the other captures in `docs/screenshots/admin/` use fictional local accounts.
- Disposable database suite: clean and upgrade paths passed, including RLS, trusted approval, active-booking approval gating, replay behavior and concurrent booking/assignment/application changes. Full log: `/tmp/hatidone-admin-db-tests.log`.
- Built client scan: 27 files passed privileged credential pattern checks. This is a targeted check, not a complete secret audit.
- `git diff --check`: passed.

## Security and scope

Private data reads and mutations require an active administrator on the server. Existing database RPC authorization, RLS, quote-version checks, eligibility checks and locks remain authoritative. The review UI never grants its own role or marks a driver online. Passenger access to another applicant's documents and admin detail pages was denied in real local checks. Signed document URLs are rendered only after authorization.

QA uses only the disposable backend at port 56321 and a temporary web server at port 3139. Review testing suspends and reinstates an existing fictional, verified, offline driver; its verification and offline status are restored. Configuration testing saves existing values and verifies incomplete submissions leave settings unchanged. Real hosted accounts and configuration are untouched.

This is a web admin update. Physical-device/native testing and hosted deployment were not performed. The operations booking list still loads the earliest 100 open bookings and labels that limit; overview totals are exact. Applicant search warns if its preliminary matching-account lookup reaches 500 results. Existing Needs Attention lists retain their prior limits.

## Overview loading fix — September 9, 2026

Read-only checks against the configured web backend confirmed that `ride_requests.quote_status` is missing (PostgreSQL `42703`). The other six overview queries succeeded. This field is introduced by `0009_rc1_release_contract.sql`; the connected schema needs the normal migration rollout before quote counts and the dependent RC1 workflows can operate fully.

The overview now collects count results independently. It displays available counts, labels failed or absent counts as unavailable, and explains when a database update is required. A missing count never becomes zero or triggers the “No work waiting” message. Count queries use GET with `limit(0)`: this returns no records while preserving diagnostic error codes that HEAD requests discarded. The live read-only comparison confirmed matching counts for the six supported queries, with zero records returned. Authorization remains the existing active-admin check and RLS; no server-role credential was added to application code and no hosted schema was changed.

Regression coverage includes a missing quote column, rejected requests, access failures, absent counts, accurate zero counts, and rendering a partially available dashboard.
