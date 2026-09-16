import { describe, expect, it } from 'vitest';
import { signupOutcome } from './signup-result';
const user = { id: 'fictional-unit-user' };
const session = { user, access_token: 'unit-only-access', refresh_token: 'unit-only-refresh' };
describe('Supabase signup result', () => {
  it('continues for a session regardless of confirmation metadata', () => {
    expect(signupOutcome({ data: { user, session }, error: null })).toBe('authenticated');
    expect(signupOutcome({ data: { user: { ...user, email_confirmed_at: null }, session }, error: null })).toBe('authenticated');
  });
  it('uses the unauthenticated continuation for a user and an explicitly null session', () => {
    expect(signupOutcome({ data: { user, session: null }, error: null })).toBe('confirmation');
  });
  it('gives errors precedence over apparent success', () => {
    expect(signupOutcome({ data: { user, session }, error: { message: 'provider failure' } })).toBe('failed');
  });
  it('rejects missing, inconsistent and incomplete responses instead of claiming success', () => {
    for (const value of [undefined, null, {}, { error: null }, { data: null, error: null },
      { data: { user: null, session: null }, error: null }, { data: { user }, error: null },
      { data: { user, session: {} }, error: null },
      { data: { user, session: { ...session, refresh_token: '' } }, error: null },
      { data: { user, session: { ...session, user: { id: 'other-user' } } }, error: null },
    ]) expect(signupOutcome(value)).toBe('failed');
  });
});
