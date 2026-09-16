import { authJourneyHref, parseIntent } from '@/lib/auth/journey';
import Link from 'next/link';
import { AuthForm } from '@/components/auth-form';
import { updateRecoveredPassword } from '@/app/auth/recovery/actions';
import { createRecoveryClient } from '@/lib/supabase/recovery';

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string; intent?: string }> }) {
  const params = await searchParams;
  const intent = parseIntent(params.intent);
  let verified = false;
  try {
    const client = await createRecoveryClient();
    const { data: { user }, error } = await client.auth.getUser();
    verified = !error && !!user;
  } catch { /* A missing backend/session is a recoverable unavailable state. */ }
  if (!verified) return <main className="auth-page"><section className="auth-card"><Link className="brand" href="/">HatidOne</Link><h1>Password recovery</h1>{params.message ? <p className="notice" role="status">{params.message}</p> : <p role="alert">No verified recovery session is available. The link may have expired or opened in a different browser.</p>}<p>A regular signed-in account or a link to this page does not authorize a password reset.</p><Link className="button button-primary" href={authJourneyHref('/forgot-password', intent)}>Request a new reset link</Link><p><Link href={authJourneyHref('/login', intent)}>Return to sign in</Link></p></section></main>;
  return <AuthForm action={updateRecoveredPassword} title="Choose a new password" description="This updates only the account verified by your recovery link. Your recovery session ends after the update." error={params.error} submitLabel="Update password" pendingLabel="Updating…" alternateHref={authJourneyHref('/forgot-password', intent)} alternateLabel="Request a new link" alternateText="Need to restart?">
    <input type="hidden" name="intent" value={intent ?? ''} /><label>New password<input name="password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required/></label>
    <label>Confirm new password<input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} maxLength={128} required/></label>
    <p className="muted">Use 8–128 characters. Additional account password rules may apply. Other devices may need to sign in again; this does not change the account currently open in another tab.</p>
  </AuthForm>;
}
