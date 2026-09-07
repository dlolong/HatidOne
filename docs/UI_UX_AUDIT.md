# UI/UX audit — 2026-09-07

Audit of the current repository before UI changes. Existing booking, authorization, RLS, fare, dispatch and trip logic remain the baseline. The working tree already changes the web port to 3003; those user edits are preserved. Source inspection covers public acquisition, auth, driver onboarding, passenger booking/history/detail, driver jobs/trips/earnings, admin dispatch/operations and fleet/partner/corporate workspaces. Native tool availability is recorded separately in the simulator guide.

## Critical UX

- Simulator execution is not yet verified. Exported native bundles do not demonstrate safe areas, keyboard behavior, GPS permissions or simultaneous installed apps. Inspect installed Xcode/Android tools and record actual launch evidence or the precise blocker.

## High

- **Design system:** web and shared native primitives use green primary actions, green-tinted surfaces, pill-shaped buttons and inconsistent text/status colors. Global web heading sizes reach 4.75rem; application pages inherit oversized dashboard headings. `apps/web/app/globals.css`, `packages/mobile/src/ui.tsx`.
- **Web navigation:** multiple wrapping navigation regions crowd the header on phones, no active destination, and admin landing prioritizes generic links/security implementation copy over operational work. `components/app-shell.tsx`, protected admin pages.
- **Passenger booking:** four steps combine locations/schedule and fare/confirmation; both location fields show every reference point and manual coordinate controls. Continue sits after the long scroll. Driver/PIN/message information is below fare metadata in booking details. Raw event/status names lack a clear current-state timeline. Passenger `app/book.tsx`, `src/LocationField.tsx`, `app/booking/[id].tsx`.
- **Driver jobs/trips:** large filter and availability blocks precede offers. Going Home is buried in a long Account page. Trip action follows duplicate route/fare/GPS details; cancellation and no-show compete with the primary lifecycle action. Fixed tab height ignores bottom inset. Driver `app/(tabs)/*`, `app/trip/[id].tsx`.
- **Operations/business:** 100-row unpaginated operations list, UUID-heavy review summaries, all configuration/safety/billing sections on one page; business six-column tables require sideways scrolling on phones. Organization schedule is secondary to aggregate figures. Protected admin/operations and organizations/[id] pages.
- **Async/error UX:** major native flows display raw backend messages; shared auth includes implementation copy. Web error boundary mentions migrations; loading screens use a page-size spinner. Error messages are not consistently connected to forms. Shared auth/resource, protected loading/error pages.

## Medium

- Onboarding displays all personal, vehicle and document forms together despite existing saved state/progress. Requirements and next steps need stronger hierarchy; expand sections independently while preserving individual server actions.
- Passenger Home lacks route-entry affordances; engineering-focused demo copy obscures the booking action. Empty lists often contain only one muted line. Activity and Bookings need clearer distinction.
- Driver cards repeat full fare details in Trips; Earnings emphasizes trip count over estimated earnings. Account exposes preferences, manual coordinates, profile and documents simultaneously. Empty data can appear before loading completes.
- Status chips conflate interactive selections and read-only labels. Web status styles use uppercase tiny text, raw names and several incompatible class families.
- Buttons generally meet minimum touch size, but inline links, weak focus feedback and glyph navigation need review. Web fields have labels but several missing autocomplete/help relationships.
- Maps of bounded native lists (up to 100 rows) create long pages. Prefer bounded pages for this pilot rather than nesting a virtualized list inside the existing ScrollView.
- Public acquisition pages need consistent compact hierarchy and clear role entry points; no new imagery/font dependency is necessary.

## Low

- Several cards use excessive radius/padding; helper labels and section headings are too uniformly bold.
- Shadow, spacing, focus and semantic status values are not documented centrally.
- Existing Android localhost settings need explicit emulator handling/documentation; the current distinct bundle IDs and light-first app configuration are a sound baseline.

## Verification plan

Compare key web routes at 375, 390, 430, 768, 1024 and 1440px. Exercise authenticated passenger/driver/admin/fleet flows against the existing local backend. Inspect both mobile apps at small/standard/large phone sizes in the browser, then attempt native tooling where available. Browser emulation is not native-device certification. Re-run strict types, lint, existing tests, production build, Expo compatibility/Doctor and native exports. No migration or authorization redesign is part of this sprint.
