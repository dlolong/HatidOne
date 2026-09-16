# RC1 execution plan

1. Audit actual routes, RPCs and tooling; preserve clean user tree (done).
2. Lead owns additive0009 schema and shared contracts. Keep ride_status unchanged: quote_status/version separately tracks review and acceptance; confirmed_at separately tracks driver reconfirmation; payments remain pending until cash reconciliation. Actor-scoped request keys reject changed payloads.
3. Mobile owns native apps + shared mobile package: adapt reviewed quotes/cash, persistent sessions, resume/retry, preview configs. Operations owns web operations + root scripts/CI/docs: attention queue, audited pause, environment checks and reproducible preparation. Integrate in shared branch; no concurrent edits to owned files.
4. QA owns isolated DB harness/adversarial tests. Verify all migrations,0008 upgrade, transaction races, permissions, integrated type/lint/test/build. Report BLOCKED external/toolchain gates separately.
5. Fix reproducible critical defects; rerun affected tests. Release lead records exact evidence and separate verdicts. No public deployment, hosted migration, signing material creation or store submission.

Manual addresses require operator quote with occupied duration + explanation. Quotes can be replaced only before assignment, must be accepted at current version, and freeze 0% commission. Assigned drivers reconfirm before heading. Trip complete creates pending cash; driver report is distinct from operations reconciliation/dispute. Optional integrations fail closed in real environments; manual in-app/human confirmation remains explicit.

## Integrated checkpoint

The manual scheduled-ride slice, quote/collection separation, safe reassignment, migration preflight, mobile/build preparation, operations controls, and isolated database verification are implemented. Independent QA ran clean and upgrade schemas, including actual concurrent transactions. Final evidence and exact check counts live in QA.md and STATUS.json; no hosted/device gate is inferred from local checks. Password recovery source handling is included in the final web/mobile verification; actual delivery remains an owner gate.
