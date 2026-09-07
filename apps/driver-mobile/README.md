# HatidOne Driver

Separate Expo Router app: Jobs, Trips, Earnings and Account. Uses shared secure sessions and native components from `@hatidone/mobile`, deterministic suggestions from `@hatidone/core`, and the existing Supabase backend. No maps, payments, SMS or push credentials are needed.

From the repository root:

```sh
npm install
cp apps/driver-mobile/.env.example apps/driver-mobile/.env
# Fill in the public Supabase URL + anon key and the web URL.
npm --workspace @hatidone/driver-mobile start
npm --workspace @hatidone/driver-mobile run typecheck
npm --workspace @hatidone/driver-mobile run export
```

Use an active driver account from local seed data. Driver registration/document upload remains in the existing web `/driver/onboarding` workflow. On a physical device, localhost points to the device; use the development computer’s LAN address. Session tokens use Expo SecureStore on native devices. Web preview uses browser local storage through the shared auth package.

Apply all database migrations before launching. Missing tables/RPCs produce a visible error; the app does not substitute simulated records. Offers, assignments, documents and messages are protected by backend authorization/RLS. Fare and commission snapshots come from the server. Accept/decline, availability, preferences, confirmation, PIN validation and trip transitions call server RPCs.

GPS is foreground only and optional for viewing trips. Grant location permission and press Update GPS for matching; manual current coordinates in Account let a verified driver become available when device GPS is unavailable. Precise coordinates do not appear in public links. Going Home requires an address, coordinates and a local departure date/time. Service reference points are approximate, and route/toll expectations are labeled as estimates. Return suggestions use the next accepted outbound ride, pickup proximity, a travel buffer and return direction. Suggestions never reserve a ride; the server rechecks acceptance eligibility.

Pull to refresh is available on each tab. Realtime updates use the existing Supabase connection, with foreground polling as a local fallback. Offline/network failures surface a retryable error. Busy status is derived from an active trip; going offline stops new dispatch availability without cancelling an assignment. No background location or always-running scheduler is implied.

Earnings show completed trip snapshots, not a wallet or payout balance. Configured commission defaults to 0%; any future changed rate is reflected in the trip snapshot. Taxes/tolls/collection adjustments are not invented. Primary assignments and confirmation are visible; backup activation remains an operations workflow.

Native device testing requires Expo Go compatible with SDK 54 or a development build. Native signing/release distribution is a separate deployment step.
