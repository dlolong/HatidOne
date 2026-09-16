'use server';
import { redirect } from 'next/navigation';
import { authJourneyHref, parseIntent } from '@/lib/auth/journey';
import { authCallbackUrl } from '@/lib/auth/redirects';
import { clearRecoveryCookies, createRecoveryClient } from '@/lib/supabase/recovery';

function recoveryRedirect(path: string, form: FormData): never {
  const intent = parseIntent(form.get('intent'));
  redirect(intent ? `${path}${path.includes('?') ? '&' : '?'}intent=${intent}` : path);
}

export async function requestPasswordReset(form: FormData) {
  const email = form.get('email');
  if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    recoveryRedirect('/forgot-password?error=Enter%20a%20valid%20email%20address.', form);
  }
  const callback = authCallbackUrl(process.env.NEXT_PUBLIC_SITE_URL);
  if (!callback) recoveryRedirect('/forgot-password?error=Password%20recovery%20is%20not%20configured.', form);
  try {
    await clearRecoveryCookies();
    const client = await createRecoveryClient();
    const redirectTo = authJourneyHref(new URL('/auth/recovery/callback', callback).toString(), form.get('intent'));
    await client.auth.resetPasswordForEmail(email.trim(), { redirectTo });
    // Do not disclose whether an account exists. Delivery/rate-limit errors are
    // intentionally not surfaced as user-specific provider diagnostics.
  } catch { /* Use the same non-enumerating response for unavailable delivery. */ }
  // The same response covers unknown accounts and transport/provider failures.
  // It never claims that an email was actually delivered.
  recoveryRedirect('/forgot-password?message=If%20the%20account%20exists%20and%20email%20delivery%20is%20available%2C%20a%20reset%20link%20can%20arrive.%20Check%20your%20inbox%20and%20spam.%20If%20nothing%20arrives%2C%20retry%20later%20or%20use%20your%20agreed%20operator%20contact.', form);
}

export async function updateRecoveredPassword(form: FormData) {
  const password = form.get('password');
  const confirmation = form.get('confirmPassword');
  if (typeof password !== 'string' || password.length < 8 || password.length > 128 || password !== confirmation) {
    recoveryRedirect('/reset-password?error=Use%208%E2%80%93128%20characters%20and%20matching%20passwords.', form);
  }
  let outcome: 'expired' | 'failed' | 'updated' = 'expired';
  try {
    const client = await createRecoveryClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (!error && user) {
      // Identity comes only from the verified recovery session, never form data
      // or the normal web session. Supabase enforces its configured policy.
      const { error: updateError } = await client.auth.updateUser({ password });
      if (updateError) outcome = 'failed';
      else {
        outcome = 'updated';
        await client.auth.signOut({ scope: 'local' });
      }
    }
  } catch { if (outcome !== 'updated') outcome = 'failed'; }
  if (outcome === 'updated') {
    await clearRecoveryCookies();
    recoveryRedirect('/reset-password?message=Password%20updated.%20Your%20recovery%20session%20has%20ended.%20Sign%20in%20with%20your%20new%20password.', form);
  }
  if (outcome === 'expired') {
    await clearRecoveryCookies();
    recoveryRedirect('/forgot-password?error=Recovery%20session%20is%20missing%20or%20expired.%20Request%20a%20new%20link.', form);
  }
  recoveryRedirect('/reset-password?error=Password%20could%20not%20be%20updated.%20Check%20the%20account%20password%20policy%20or%20request%20a%20new%20link.', form);
}
