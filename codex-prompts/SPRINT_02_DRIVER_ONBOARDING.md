# Codex Task — Sprint 02 Driver Onboarding

Read `AGENTS.md` first.

Implement driver onboarding using the existing migration as a base.

Add migrations for:
- driver_documents
- vehicle_documents

UI:
- `/driver/onboarding`
- personal details
- vehicle details
- document upload placeholders
- onboarding progress

Rules:
- Driver cannot mark themselves verified.
- Store sensitive documents in private storage.
- Add expiration date support.
- Admin review fields must be server-protected.
- Add loading/error/empty/success states.
- Add tests for authorization-sensitive helpers.
