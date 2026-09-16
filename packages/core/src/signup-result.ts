export type SignupOutcome = 'authenticated' | 'confirmation' | 'failed';

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
function nonempty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

// Supabase's result determines the journey, never a local confirmation flag.
// This classifies navigation only; server/RLS checks still verify identity.
export function signupOutcome(result: unknown): SignupOutcome {
  if (!record(result) || result.error !== null || !record(result.data)) return 'failed';
  const { user, session } = result.data;
  if (!record(user) || !nonempty(user.id)) return 'failed';
  if (session === null) return 'confirmation';
  if (!record(session) || !record(session.user) || session.user.id !== user.id
    || !nonempty(session.access_token) || !nonempty(session.refresh_token)) return 'failed';
  return 'authenticated';
}
