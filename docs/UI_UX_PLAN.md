# UI/UX implementation plan — 2026-09-07

## Ownership and sequence

1. **Audit/design lead (root):** inspect current code, record ranked audit before edits, preserve existing port-3003 changes and all business/security boundaries.
2. **Shared design and web (root):** establish black/light neutral tokens; reusable status, empty/loading/error components; compact role navigation; operations-first admin landing; tabbed operational/business sections; responsive stacked records; progressive onboarding forms and concise auth copy.
3. **Passenger worktree:** five-step booking with reachable footer, compact location selection, stronger Home/driver/PIN hierarchy, human timeline, useful state/retry UI, accessible safe-area tabs. Own app/src UI only.
4. **Driver worktree:** earnings-first offers, visible Going Home entry, focused trip action, compact Trips/Earnings, grouped Account and safe-area navigation. Own app/src UI only.
5. **Simulator worktree:** inspect actual native tools, add compatible development client and exact workspace commands, preserve unique app IDs/foreground-only GPS, document emulator hosts and real launch evidence. Own manifests, lockfile, helper scripts and simulator guide.
6. **Integration/QA (root with available agents):** merge bounded commits, inspect visuals and real flows, repair confirmed issues, run existing checks, document remaining native/provider limits and final review.

## Design decisions

- Primary/text #111111, pressed #000000, surface #FFFFFF, page #F7F7F5, muted surface #F2F2F0, border #E5E5E2, secondary text #6B6B67. Semantic green/amber/red only convey status; muted #92928D is decorative, not essential small text.
- System fonts, page headings approximately 28–34px web/26px native, section headings 18–20px, body 16px. Weight 400/500 for prose/labels and 600 for important headings/totals.
- Standard action/input height 48–50px, radius 10–12px; cards 14px; restrained borders/shadows. Keyboard focus remains visible. Reduced-motion preferences respected.
- Existing four mobile destinations stay intact. Shared native APIs remain backward compatible: Screen footer/scrollKey, Heading size, StatusPill, EmptyState, LoadingSkeleton, safe user-error presentation.
- Prefer click/tap section selection and bounded result pages to extensive scrolling. Preserve server filtering, authorization checks, financial snapshots, state transitions and existing write actions.

## Acceptance evidence

- Typecheck/lint for all apps; existing unit/database/HTTP tests as backend availability permits; web build; mobile dependency checks and Expo Doctor; all-platform exports.
- Responsive screenshots/overflow and keyboard checks for major role pages; authenticated critical flow smoke; runtime console review.
- Actual simulator/emulator launch attempts when installed tooling supports them; clearly distinguish unavailable SDK/tooling from a successful native launch.
- Final docs: DESIGN_SYSTEM.md, MOBILE_SIMULATOR_GUIDE.md, UI_UX_COMPLETION_REPORT.md. No new product features during final QA.
