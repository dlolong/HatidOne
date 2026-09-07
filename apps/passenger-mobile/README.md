# Passenger mobile

Expo Router passenger app with Home, Bookings, Activity and Account tabs. Requires Node 20.19+ and the repository Supabase migrations. No maps, SMS, push or payment credentials are required.

```sh
npm install
cp apps/passenger-mobile/.env.example apps/passenger-mobile/.env
# Set only the existing public Supabase URL and anon/publishable key.
npm --workspace @hatidone/passenger-mobile start
npm --workspace @hatidone/passenger-mobile run web
npm --workspace @hatidone/passenger-mobile run typecheck
npm --workspace @hatidone/passenger-mobile run check
npm --workspace @hatidone/passenger-mobile run export:web
```

SDK 54 is pinned to its supported React Native 0.81.5 / React 19.1 dependency set. Use a compatible Expo Go client or a local development build (`npx expo run:ios` / `run:android` from this directory). Native device builds require the corresponding platform SDK. SDK reference: https://docs.expo.dev/versions/v54.0.0/ . A physical device must reach Supabase at your computer’s LAN address; localhost refers to the device itself.

Email/password login uses Supabase Auth. Native sessions persist in Expo SecureStore; browser sessions use same-origin localStorage. Email confirmation follows your existing Supabase settings. Signup creates a passenger role through the database trigger. Roles and verification cannot be edited in the app.

Choose local reference points or enter a real address and coordinates. Foreground GPS is optional. Known points are approximate, and the UI explains that the local provider calculates straight-line estimates with no road/traffic/toll authority. The server calculates fare both when quoting and confirming. Cash remains the baseline. `EXPO_PUBLIC_DEMO_MODE=true` adds an explicit demo banner; it does not bypass login, persistence or authorization.

Messages, booking status and notifications refresh through Supabase Realtime with polling fallback. No background worker, push notification delivery or emergency response is claimed. Private share links require authentication and booking authorization; they never expose live GPS or a passenger PIN publicly.

Partner handoff: `hatidone-passenger://book?partner_id=UUID&external_reference=RESERVATION&pickup=ADDRESS&destination=ADDRESS&destination_lat=14.1&destination_lng=120.9&scheduled_at=ISO8601&guest_count=2&service_type=transfer`. All query values are untrusted: the user reviews them, and the server validates the request and referral. No external partner credentials are needed. The destination query supports optional coordinates; a missing pickup coordinate must be chosen before quoting.

Smoke check: sign up / sign in, relaunch and verify restored session; choose Makati → Tagaytay; schedule tomorrow; choose two passengers and sedan; review server fare and confirm twice rapidly; check a single booking; assign a driver from operations; open the driver card and PIN; exchange messages; open Activity; cancel before trip start or complete via driver app and rebook. Verify unrelated accounts cannot open the shared private booking link. Device launch and live Supabase checks require a reachable configured backend.
