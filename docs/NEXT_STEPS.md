# Recommended Next Steps

1. Initialize Git repository and push to a private GitHub repo.
2. Create a development Supabase project.
3. Run migration `0001_initial.sql` in development only.
4. Give Codex `SPRINT_01_FOUNDATION.md` and require it to read `AGENTS.md` first.
5. Review the generated diff before merging.
6. Run a second Codex review using `SPRINT_05_SECURITY_REVIEW.md` after auth/RLS changes.
7. Continue with Sprint 02 and Sprint 03.

## Do not connect yet
- Production payment secrets
- Production service-role credentials
- Real driver document production buckets
- Production ride operations

## First milestone
A user can sign up, become a passenger, create a scheduled ride request, and view it securely in their own account.
