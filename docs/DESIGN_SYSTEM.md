# HatidOne design system

HatidOne uses a light-first, black primary design language across Next.js and React Native. Web CSS and native primitives are separate implementations of the same rules. No new font service, paid icon kit, or raster image dependency is required.

## Colors

| Purpose | Value | Use |
| --- | --- | --- |
| Primary / text | `#111111` | Primary actions, selected navigation, titles and body |
| Pressed / hover | `#000000` | Primary action feedback |
| Surface | `#FFFFFF` | Cards, fields, headers |
| Page | `#F7F7F5` | Calm secondary background |
| Muted surface | `#F2F2F0` | Supporting notices, selected context, message bubbles |
| Border | `#E5E5E2` | Thin neutral separators |
| Secondary text | `#6B6B67` | Descriptions and helper text |
| Success | `#21633D` on `#EDF6EF` | Verified, available, completed, settled |
| Warning | `#805C12` on `#FFF6DF` | Pending, under review, payment due |
| Danger | `#A32929` on `#FFF1F0` | Errors, cancelled, rejected and suspended states |

Do not use semantic colors as decoration. Status labels carry the meaning independently of color. The proposed lighter muted gray `#92928D` is intentionally not used for essential small text. Selected choices use black, not green. Blue is reserved for future meaningful information rather than a secondary brand color.

## Typography

Use the native/system font stack. Body is normally 16px, helper copy 14–15px, compact status text 13px. Web application titles are 28–35px; native page titles are 26px with 33px line height. Section titles are 18–20px. Public hero titles can be larger, capped at 56px.

Use regular weight for prose, 500 for labels/buttons, and 600 for page titles, primary fare/earnings totals and key ride facts. Do not apply bold weight to an entire card. Philippine schedule displays use `Asia/Manila`; fares use the Philippine peso locale. Native scheduling fields state their date/time format explicitly.

## Spacing, radius and shadows

Use 4/8/12/16/20/24/32px spacing. Native screens use 20px horizontal padding; small web pages use 16–18px. Cards use 18–20px internal padding, 12–16px separation, thin borders and approximately 14px radius. Buttons/inputs use 10–12px radius; status badges use 6px. Avoid nested cards when a separator or neutral message bubble is enough.

Shadows are optional and subtle: web `0 2px 10px rgb(0 0 0 / 3%)`. Layout does not depend on elevated shadows. No decorative animation is introduced. Web respects reduced-motion preferences.

## Buttons and inputs

Primary buttons have black backgrounds and white labels. Secondary buttons have white surfaces, dark labels and a visible neutral border. Destructive actions use red only when meaningful, with confirmation for existing cancellation/backup flows. Native buttons are at least 50px high; web actions at least 48px. Buttons communicate pending/disabled state and prevent repeat taps while busy.

Labels appear above inputs, with 16px input text to remain readable on phones. Use appropriate email, telephone, numeric and password autocomplete/keyboard hints. Required custom coordinates reveal their disclosure and retain form data on invalid input; reference locations provide a quicker route. Native `Field` supports `hint`, `error`, focus feedback and accessibility descriptions. Web form errors use alerts and auth fields refer to the relevant error.

## Shared components

- Native `packages/mobile/src/ui.tsx`: `Screen`, `Card`, `Heading`, `Muted`, `Row`, `Notice`, `Button`, `Field`, `Chip`, `StatusPill`, `EmptyState`, `LoadingSkeleton`.
- `Screen` owns safe-area edges, keyboard avoidance, optional refresh, a `scrollKey` for step resets, and an optional footer outside the scroll content. Use `bottomInset` on standalone screens without a tab bar. Native keyboard behavior still requires device acceptance testing.
- `Heading size="section"` prevents every card from competing with the page title. `Chip` selects a choice; `StatusPill` reports a read-only state.
- Native `userError` presents known auth/network failures and safe fallbacks. Driver-specific lifecycle failures retain useful explanations without exposing SQL/provider internals.
- Web `components/ui.tsx`: standardized status, empty and skeleton surfaces; existing submit/form/card components retain their server actions.
- Web `WorkspaceTabs`: accessible tab list, arrow/Home/End navigation, matching panels, hash links and per-workspace session restoration. Hidden sections retain their forms and data.
- Web ride list components: search/filter, bounded eight-row pages and labelled stacked records on narrow screens.
- Web `LocationFields`: shared known-location/GPS/manual-coordinate presentation for passenger and business booking; financial and coordinate validation remain authoritative on the server.

## Navigation and screen hierarchy

Passenger native: Home, Bookings, Activity, Account. Driver native: Jobs, Trips, Earnings, Account. Both use existing Ionicons with text labels and safe-area-aware tab heights. Important standalone trip/booking actions sit in the screen footer.

Web uses a compact role-specific four-destination navigation row and a More menu for secondary destinations. Current routes are marked. Business and Operations pages use compact selectable sections, with their main tasks first. Avoid adding a scrolling sidebar or nesting page-level scroll containers.

Passenger booking has five steps: route, schedule, vehicle, fare, confirmation. Driver offers show pickup, destination, schedule, capacity/vehicle requirement, distance/duration, fare, commission and estimated earnings before acceptance. Driver trip controls follow the existing state machine. Going Home is reachable directly from Jobs.

## Loading, empty and error states

Use restrained skeleton blocks for initial async loads. Empty states state what is missing and offer a relevant next action or retry. Errors say what failed and how to recover; do not render raw Supabase/SQL messages. Chat remains participant-only; pickup PINs retain their existing privacy boundaries.

## Responsive and accessibility checks

Required web widths: 375, 390, 430, 768, 1024 and 1440px. Avoid horizontal page overflow and forced desktop tables on phones. Use labelled stacked table cells, flexible button groups, readable cards and bounded result pages. Keep focus visible, headings semantic, errors announced and controls labelled. Native/browser text and screenshots do not replace VoiceOver/TalkBack, large-text, hardware keyboard, physical GPS or native keyboard testing.
