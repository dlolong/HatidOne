import Link from 'next/link';
import { authJourneyHref, journeyDestination, parseIntent } from '@/lib/auth/journey';
import { AuthForm } from '@/components/auth-form';
import { PasswordField } from '@/components/password-field';
import { SubmitButton } from '@/components/submit-button';
import { login, resendConfirmation } from '@/app/auth/actions';
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string; next?: string; intent?: string }> }) {
  const params = await searchParams;
  const intent = parseIntent(params.intent);
  return <AuthForm action={login}
    title={intent === 'driver' ? 'Continue your driver application' : 'Welcome back'}
    description={intent === 'driver' ? 'Use your existing HatidOne account—no new signup needed. We’ll open your application or approved driver dashboard.' : intent === 'passenger' ? 'Sign in to continue booking your ride.' : 'Access your rides and account.'}
    alternateHref={authJourneyHref('/signup', intent, params.next)} alternateLabel="Create an account" alternateText="New to HatidOne?"
    error={params.error} message={params.message} pendingLabel="Signing in…" submitLabel="Sign in"
    afterForm={<details className="confirmation-help"><summary>Need to confirm your email?</summary><p className="muted">Use the confirmation email to continue. If you opened it on another device and are still signed out, sign in here with the same email and password. Your selected journey stays in this link.</p><form action={resendConfirmation} className="form-stack">
      <input name="intent" type="hidden" value={intent ?? ''} /><input name="next" type="hidden" value={journeyDestination(intent, params.next)} />
      <label>Account email<input name="email" type="email" autoComplete="email" required /></label><SubmitButton pendingLabel="Requesting confirmation…">Resend confirmation email</SubmitButton>
    </form><p className="muted">A request does not confirm delivery or verify your email.</p></details>}>
    <input name="intent" type="hidden" value={intent ?? ''} /><input name="next" type="hidden" value={journeyDestination(intent, params.next)} />
    <label>Email<input aria-describedby={params.error ? 'auth-error' : undefined} aria-invalid={!!params.error} autoComplete="email" name="email" required type="email" /></label>
    <PasswordField autoComplete="current-password" describedBy={params.error ? 'auth-error' : undefined} invalid={!!params.error} />
    <Link href={authJourneyHref('/forgot-password', intent, params.next)}>Forgot your password?</Link>
  </AuthForm>;
}
