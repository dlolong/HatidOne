# Controlled pilot operator runbook

This is a manual workflow. No scheduler, closed-app notification delivery, 24/7 staffing, backup-driver guarantee or automatic emergency dispatch has been verified. Owner must provide real support contact, hours, responsible operator and escalation procedure before invited real-backend use. All displayed operational times use Asia/Manila.

## Before opening

1. Confirm the correct environment, release versions, migration compatibility and gate approval. Use fictional bookings until the intended data handling and operational gates are approved.
2. Sign into Admin → Operations. Review **Needs Attention**, unresolved incidents, verification and account-deletion requests. Deletion requests require the approved retention/identity-verification procedure; their presence does not mean any data was deleted. The queue is capped at 200 records per source and says when it was loaded; refresh and cross-check dispatch/history. This is not an exhaustive monitoring system.
3. Confirm each upcoming driver personally through the agreed contact channel. Require their in-app reconfirmation. Check vehicle and document validity, route geography and occupied duration including operational buffer. An assignment is not a reconfirmation or arrival promise.
4. In System → Release controls, leave integrations off unless their intended behavior is tested; turning them on does not provision providers. Open the configured pilot service area and clear booking pause only after staffing/coverage is confirmed. Record a reason; the database audits the change. Opening a service area does not establish legal permission to operate there.

## Request to completion

- Review pickup/drop-off addresses and landmarks with the passenger. Without a verified route provider, review route uncertainty and occupied minutes manually; do not use a straight-line estimate as a real fare. In Needs Attention offer the reviewed PHP total and explanation, including agreed toll handling. Keep the existing 0% HatidOne commission policy. Passenger must accept the current quote version. Do not silently revise an accepted price.
- Dispatch only after quote acceptance. Select an eligible driver/vehicle and enter an assignment/schedule-review reason. A stale version or changed eligibility must fail and prompt a refresh. Coordinate by the agreed channel, then have the driver reconfirm in their app. Do not count an in-app notification as delivered to a closed app.
- Refresh upcoming rides regularly during the staffed window. Dispatch → **Expire old offers** is a manual, retry-safe operation; no browser timer is a deployed job. Needs Attention flags lack of trip state change after 30 minutes; this is not GPS age or proof that a trip is unsafe.
- Driver records heading, arrival and PIN-verified start. Passenger provides their PIN only at pickup; operators/drivers must not retrieve expected secrets or log them. Repeated wrong PINs require the authorized recovery procedure, never a database edit or guessed PIN.
- Complete the trip once. A timeout is not failure: refetch authoritative state before retrying. Completion does not collect cash. Driver records the actual collected PHP amount with its stable operation ID. Operations reviews evidence and separately records reconciliation or dispute in Needs Attention. A driver report is not gateway verification. Do not mark a disputed/outstanding amount paid to tidy the queue.

## Cancellation, no-show, document change and incidents

Contact both participants, establish their current state, and record a factual reason through available authorized actions. Do not casually reassign an active passenger trip. Legacy backup activation remains demo-only. Needs Attention permits a reasoned, version-checked reassignment only while the ride is assigned and before the driver heads to pickup. Verify replacement driver/vehicle references and contact both participants first. The database rechecks schedule/documents and rotates the pickup PIN; require replacement driver reconfirmation. If the version/state changed, refresh and review instead of forcing replacement. Never cancel/rebook to hide an active trip or its cash history. If an expired document or suspension makes a driver ineligible, pause new allocation to that driver and arrange a reviewed recovery. Preserve quote/cancellation/payment audit records. If no safe replacement is confirmed, communicate that explicitly; do not promise one.

Safety reports enter the manual queue. The safety UI is not a call to an emergency service. The owner must define real escalation contacts and hours; do not invent numbers or guarantees. For urgent danger use the applicable actual local emergency channel and human response procedure. Resolve a report only after recording review facts and the operator note.

## Closing or incident pause

System → Release controls → pause new bookings or close the entire configured service area, with reason. Both affect new requests only; confirmed and active trips stay accessible. Integrations off disables optional provider behavior, while core auth/state/manual cash must remain available. Finish or explicitly recover every active ride and reconcile outstanding cash before ending staffing. Inform upcoming participants of unavailable coverage using the agreed channel.

## Failed release

Keep new requests paused; preserve logs without tokens/PINs/identity documents. Compare app/backend versions and health checks. Refetch uncertain operations using their original identifiers. Roll back only to a schema-compatible app/server build; never reset the database, reseed or drop audit/payment history. Use the authorized restore rehearsal in DEPLOYMENT.md if needed. Record actions, affected anonymized IDs and final outcomes; reopen only after the same lifecycle smoke test and coverage review pass.
