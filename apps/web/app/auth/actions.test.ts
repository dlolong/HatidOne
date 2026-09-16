import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ create: vi.fn(), signIn: vi.fn(), signUp: vi.fn(), resend: vi.fn(), signOut: vi.fn(), rpc: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: (url: string) => { throw new Error(`REDIRECT ${url}`); } }));
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.create }));
import { login, signup, resendConfirmation, logout } from './actions';
function form(values: Record<string, string> = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ firstName: 'Test', lastName: 'Applicant', email: 'fictional@example.test', password: 'Fictional-password1!', intent: 'driver', ...values })) data.set(key, value);
  return data;
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://configured.example.test');
  mocks.create.mockResolvedValue({ auth: { signInWithPassword: mocks.signIn, signUp: mocks.signUp, resend: mocks.resend, signOut: mocks.signOut }, rpc: mocks.rpc });
  mocks.signIn.mockResolvedValue({ error: null });
  mocks.signUp.mockResolvedValue({ data: { user: { id: 'test' }, session: null }, error: null });
  mocks.resend.mockResolvedValue({ error: null });
  mocks.rpc.mockResolvedValue({ error: null });
});
it('requires a journey and never accepts privileged metadata', async () => {
  await expect(signup(form({ intent: 'admin', role: 'admin' }))).rejects.toThrow('Choose%20whether');
  expect(mocks.signUp).not.toHaveBeenCalled();
  await expect(signup(form({ role: 'admin', verification_status: 'verified' }))).rejects.toThrow('/login?intent=driver');
  expect(mocks.signUp.mock.calls[0][0].options.data).toEqual({ first_name: 'Test', last_name: 'Applicant' });
});
it('does not bootstrap without session and sends trusted confirmation context', async () => {
  await expect(signup(form({ next: '//evil.test' }))).rejects.toThrow('/login?intent=driver');
  expect(mocks.rpc).not.toHaveBeenCalled();
  expect(mocks.signUp.mock.calls[0][0].options.emailRedirectTo).toBe('https://configured.example.test/auth/callback?intent=driver');
});
it('bootstraps only authenticated driver signup and routes setup failure to retry with same account', async () => {
  mocks.signUp.mockResolvedValue({ data: { user: { id: 'test' }, session: { user: { id: 'test' }, access_token: 'unit-only-access', refresh_token: 'unit-only-refresh' } }, error: null });
  await expect(signup(form())).rejects.toThrow('REDIRECT /driver-application');
  expect(mocks.rpc).toHaveBeenCalledWith('request_driver_application');
  mocks.rpc.mockResolvedValue({ error: { message: 'sensitive provider failure' } });
  await expect(signup(form())).rejects.toThrow('Your%20account%20is%20ready');
  mocks.rpc.mockClear();
  await expect(signup(form({ intent: 'passenger', next: '/book?partner_id=test' }))).rejects.toThrow('REDIRECT /book?partner_id=test');
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it('preserves intent through login errors and never creates an application on login', async () => {
  mocks.signIn.mockResolvedValue({ error: { message: 'fictional unknown email' } });
  await expect(login(form())).rejects.toThrow('REDIRECT /login?intent=driver&error=');
  mocks.signIn.mockResolvedValue({ error: null });
  await expect(login(form())).rejects.toThrow('REDIRECT /driver-application');
  await expect(login(form({ intent: 'passenger', next: '/booking/example' }))).rejects.toThrow('REDIRECT /booking/example');
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it('resend retains intent with conditional nonenumerating responses', async () => {
  let previous = '';
  for (const error of [null, { message: 'not registered' }, { message: 'rate limit' }]) {
    mocks.resend.mockResolvedValue({ error });
    try { await resendConfirmation(form()); } catch (error) {
      if (previous) expect(String(error)).toBe(previous);
      previous = String(error);
    }
  }
  expect(previous).toContain('/login?intent=driver&message=');
  expect(mocks.resend.mock.calls[0][0].options.emailRedirectTo).toBe('https://configured.example.test/auth/callback?intent=driver');
});
it('provider-safe signup failures offer existing-account recovery without losing journey', async () => {
  mocks.signUp.mockResolvedValue({ data: { session: null }, error: { message: 'user exists' } });
  await expect(signup(form())).rejects.toThrow('/signup?intent=driver&error=Unable%20to%20complete%20signup');
});

it('keeps driver context when switching accounts while normal logout remains neutral', async () => {
  await expect(logout(form())).rejects.toThrow('REDIRECT /login?intent=driver&message=');
  await expect(logout()).rejects.toThrow('REDIRECT /login?message=');
  expect(mocks.signOut).toHaveBeenCalledTimes(2);
});

it('does not require callback configuration to continue an authenticated signup', async () => {
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
  mocks.signUp.mockResolvedValue({ data: { user: { id: 'test' }, session: { user: { id: 'test' }, access_token: 'unit-only-access', refresh_token: 'unit-only-refresh' } }, error: null });
  await expect(signup(form())).rejects.toThrow('REDIRECT /driver-application');
  expect(mocks.signUp.mock.calls[0][0].options).not.toHaveProperty('emailRedirectTo');
  expect(mocks.create).toHaveBeenCalledWith({ requireCookieWrite: true });
});
it('provides an honest same-account recovery when no session and no callback are available', async () => {
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
  await expect(signup(form())).rejects.toThrow('/login?intent=driver&error=No%20signed-in%20session');
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it('does not turn absent or malformed signup results into confirmation or protected redirects', async () => {
  for (const response of [undefined, { data: null, error: null }, { data: { user: null, session: null }, error: null }, { data: { user: { id: 'test' }, session: {} }, error: null }]) {
    mocks.signUp.mockResolvedValue(response);
    await expect(signup(form())).rejects.toThrow('/signup?intent=driver&error=Unable%20to%20complete%20signup');
  }
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it('never bootstraps on provider or session-persistence failure', async () => {
  mocks.signUp.mockRejectedValue(new Error('Cookie write failed'));
  await expect(signup(form())).rejects.toThrow('/signup?intent=driver&error=Unable%20to%20complete%20signup');
  expect(mocks.rpc).not.toHaveBeenCalled();
});
