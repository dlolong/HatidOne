import { authJourneyHref, parseIntent } from '@/lib/auth/journey';
import { AuthForm } from '@/components/auth-form';
import { requestPasswordReset } from '@/app/auth/recovery/actions';
export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string; intent?: string }> }) {
  const params = await searchParams;
  const intent = parseIntent(params.intent);
  return <AuthForm action={requestPasswordReset} title="Reset your password" description="Request a reset link for your account email. Open the email link in this same browser within 15 minutes; email delivery must be available." error={params.error} message={params.message} submitLabel="Request reset link" pendingLabel="Requesting…" alternateHref={authJourneyHref('/login', intent)} alternateLabel="Sign in" alternateText="Remember your password?">
    <input type="hidden" name="intent" value={intent ?? ''} /><label>Email<input name="email" type="email" autoComplete="email" maxLength={254} required/></label>
    <p className="muted">No link received? Check spam, wait before retrying, or use the operator contact agreed for your test. Requesting a link does not confirm delivery.</p>
  </AuthForm>;
}
