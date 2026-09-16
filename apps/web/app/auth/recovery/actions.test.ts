import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ create: vi.fn(), clear: vi.fn(), reset: vi.fn(), getUser: vi.fn(), update: vi.fn(), signOut: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error(`REDIRECT ${path}`); } }));
vi.mock('@/lib/supabase/recovery', () => ({ createRecoveryClient: mocks.create, clearRecoveryCookies: mocks.clear }));
import { requestPasswordReset, updateRecoveredPassword } from './actions';
function form(values: Record<string, string>) { const data = new FormData(); for (const [name, value] of Object.entries(values)) data.set(name, value); return data; }
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://staging.example.test');
  mocks.create.mockResolvedValue({ auth: { resetPasswordForEmail: mocks.reset, getUser: mocks.getUser, updateUser: mocks.update, signOut: mocks.signOut } });
  mocks.reset.mockResolvedValue({ error: null });
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'verified-recovery-owner' } }, error: null });
  mocks.update.mockResolvedValue({ error: null });
  mocks.signOut.mockResolvedValue({ error: null });
});
it('uses only the configured origin and a fixed recovery callback, without a user-controlled next URL', async () => {
  await expect(requestPasswordReset(form({ email: 'fictional@example.test', next: 'https://evil.example' }))).rejects.toThrow('REDIRECT /forgot-password?message=If%20the%20account%20exists');
  expect(mocks.reset).toHaveBeenCalledWith('fictional@example.test', { redirectTo: 'https://staging.example.test/auth/recovery/callback' });
  expect(mocks.clear).toHaveBeenCalledOnce();
});
it('gives the same non-delivery-confirming result for unknown accounts and provider failures', async () => {
  const results: string[] = [];
  for (const error of [null, { message: 'account unknown' }, { message: 'email provider unavailable' }]) {
    mocks.reset.mockResolvedValue({ error });
    try { await requestPasswordReset(form({ email: 'fictional@example.test' })); } catch (error) { results.push(String(error)); }
  }
  expect(new Set(results).size).toBe(1);
  expect(results[0]).not.toContain('account unknown');
});
it('rejects invalid email and absent callback configuration before invoking recovery', async () => {
  await expect(requestPasswordReset(form({ email: 'invalid' }))).rejects.toThrow('valid%20email');
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
  await expect(requestPasswordReset(form({ email: 'fictional@example.test' }))).rejects.toThrow('not%20configured');
  expect(mocks.create).not.toHaveBeenCalled();
});
it('does not update a password with missing, expired, or revoked recovery identity', async () => {
  for (const result of [{ data: { user: null }, error: null }, { data: { user: { id: 'untrusted' } }, error: { message: 'expired' } }]) {
    mocks.getUser.mockResolvedValue(result);
    await expect(updateRecoveredPassword(form({ password: 'Fictional-test-password1!', confirmPassword: 'Fictional-test-password1!', user_id: 'someone-else' }))).rejects.toThrow('missing%20or%20expired');
  }
  expect(mocks.update).not.toHaveBeenCalled();
});
it('updates only the verified recovery account then removes the scoped session', async () => {
  await expect(updateRecoveredPassword(form({ password: 'Fictional-test-password1!', confirmPassword: 'Fictional-test-password1!', user_id: 'someone-else', email: 'someone-else@example.test' }))).rejects.toThrow('Password%20updated');
  expect(mocks.getUser).toHaveBeenCalledOnce();
  expect(mocks.update).toHaveBeenCalledWith({ password: 'Fictional-test-password1!' });
  expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'local' });
  expect(mocks.clear).toHaveBeenCalledOnce();
});
it('rejects mismatched passwords and surfaces a safe update failure without claiming success', async () => {
  await expect(updateRecoveredPassword(form({ password: 'Fictional-test-password1!', confirmPassword: 'different' }))).rejects.toThrow('matching%20passwords');
  expect(mocks.create).not.toHaveBeenCalled();
  mocks.update.mockResolvedValue({ error: { message: 'sensitive-provider-rejection' } });
  await expect(updateRecoveredPassword(form({ password: 'Fictional-test-password1!', confirmPassword: 'Fictional-test-password1!' }))).rejects.toThrow('Password%20could%20not%20be%20updated');
  expect(mocks.signOut).not.toHaveBeenCalled();
});
it('does not swallow the success redirect when recovery signout throws after password update', async () => {
  mocks.signOut.mockRejectedValue(new Error('fictional provider unavailable'));
  await expect(updateRecoveredPassword(form({ password: 'Fictional-test-password1!', confirmPassword: 'Fictional-test-password1!' }))).rejects.toThrow('REDIRECT /reset-password?message=Password%20updated');
  expect(mocks.update).toHaveBeenCalledOnce();
  expect(mocks.clear).toHaveBeenCalledOnce();
});
it('fails closed without leaking provider details when identity verification throws', async () => {
  mocks.getUser.mockRejectedValue(new Error('fictional-sensitive-token-like-provider-diagnostic'));
  let message = '';
  try { await updateRecoveredPassword(form({ password: 'Fictional-test-password1!', confirmPassword: 'Fictional-test-password1!' })); }
  catch (error) { message = String(error); }
  expect(message).toContain('Password%20could%20not%20be%20updated');
  expect(message).not.toContain('fictional-sensitive');
  expect(mocks.update).not.toHaveBeenCalled();
});
it('rejects non-string password values and overlong values before accessing recovery credentials', async () => {
  const missing = new FormData();
  await expect(updateRecoveredPassword(missing)).rejects.toThrow('matching%20passwords');
  await expect(updateRecoveredPassword(form({ password: 'x'.repeat(129), confirmPassword: 'x'.repeat(129) }))).rejects.toThrow('matching%20passwords');
  expect(mocks.create).not.toHaveBeenCalled();
});

it('retains allowlisted driver intent through recovery request and password errors', async () => {
  await expect(requestPasswordReset(form({ email: 'fictional@example.test', intent: 'driver', next: '//evil.test' }))).rejects.toThrow('intent=driver');
  expect(mocks.reset).toHaveBeenCalledWith('fictional@example.test', { redirectTo: 'https://staging.example.test/auth/recovery/callback?intent=driver' });
  await expect(updateRecoveredPassword(form({ intent: 'driver' }))).rejects.toThrow('intent=driver');
});
