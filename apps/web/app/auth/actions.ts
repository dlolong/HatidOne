'use server';

import { redirect } from 'next/navigation';
import { signupOutcome, type SignupOutcome } from '@hatidone/core';
import { createClient } from '@/lib/supabase/server';
import { authCallbackUrl } from '@/lib/auth/redirects';
import { authJourneyHref, journeyDestination, journeyNotice, parseIntent } from '@/lib/auth/journey';

function requiredText(form: FormData, key: string): string | null {
  const value = form.get(key);
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
function authError(path: '/login' | '/signup', form: FormData, message: string): never {
  redirect(journeyNotice(path, form.get('intent'), form.get('next'), 'error', message));
}
function confirmationDestination(form: FormData): string | null {
  const callback = authCallbackUrl(process.env.NEXT_PUBLIC_SITE_URL);
  return callback ? authJourneyHref(callback, form.get('intent'), form.get('next')) : null;
}

export async function login(form: FormData) {
  const email = requiredText(form, 'email');
  const password = form.get('password');
  if (!email || typeof password !== 'string' || !password) authError('/login', form, 'Email and password are required.');
  const client = await createClient({ requireCookieWrite: true });
  let succeeded = false;
  try {
    const { error } = await client.auth.signInWithPassword({ email, password });
    succeeded = !error;
  } catch { /* Provider-safe retry; never expose account existence or diagnostics. */ }
  if (!succeeded) authError('/login', form, 'Unable to sign in. Check your email and password, or confirm your email.');
  redirect(journeyDestination(form.get('intent'), form.get('next')));
}

export async function signup(form: FormData) {
  const intent = parseIntent(form.get('intent'));
  if (!intent) authError('/signup', form, 'Choose whether you need a ride or want to drive.');
  const firstName = requiredText(form, 'firstName');
  const lastName = requiredText(form, 'lastName');
  const email = requiredText(form, 'email');
  const password = form.get('password');
  if (!firstName || !lastName || !email || typeof password !== 'string' || !password) authError('/signup', form, 'All fields are required.');
  if (firstName.length > 80 || lastName.length > 80 || email.length > 254) authError('/signup', form, 'Review your name and email.');
  if (password.length < 8) authError('/signup', form, 'Password must be at least 8 characters.');
  const emailRedirectTo = confirmationDestination(form);
  const client = await createClient({ requireCookieWrite: true });
  let outcome: SignupOutcome = 'failed';
  try {
    // The installed SSR SDK awaits SIGNED_IN cookie writes before resolving.
    const result = await client.auth.signUp({ email, password, options: {
      data: { first_name: firstName, last_name: lastName },
      ...(emailRedirectTo ? { emailRedirectTo } : {}),
    } });
    outcome = signupOutcome(result);
  } catch { /* Includes provider errors and failed session persistence. */ }
  if (outcome === 'failed') authError('/signup', form, 'Unable to complete signup. Try again, or sign in or recover your existing account.');
  if (outcome === 'authenticated') {
    if (intent === 'driver') {
      // Authenticated POST only. A callback GET never creates application rows.
      let setupFailed = false;
      try { const { error } = await client.rpc('request_driver_application'); setupFailed = !!error; }
      catch { setupFailed = true; }
      if (setupFailed) redirect('/driver-application?error=Your%20account%20is%20ready.%20Retry%20starting%20your%20application%20below.');
    }
    redirect(journeyDestination(intent, form.get('next')));
  }
  if (!emailRedirectTo) redirect(journeyNotice('/login', intent, form.get('next'), 'error', 'No signed-in session was returned. Confirmation may be needed, but this site’s callback is not configured. Ask your operator to configure it, then sign in or request a new link with this same account.'));
  redirect(journeyNotice('/login', intent, form.get('next'), 'message', 'If confirmation is needed and delivery is available, check your email. Open the link in this browser. Already registered? Sign in or reset your password.'));
}

export async function resendConfirmation(form: FormData) {
  const email = requiredText(form, 'email');
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) authError('/login', form, 'Enter a valid email address to request confirmation.');
  const emailRedirectTo = confirmationDestination(form);
  if (!emailRedirectTo) authError('/login', form, 'Account confirmation is not configured.');
  try {
    const client = await createClient();
    await client.auth.resend({ type: 'signup', email, options: { emailRedirectTo } });
  } catch { /* Same conditional response for all accounts and delivery outcomes. */ }
  redirect(journeyNotice('/login', form.get('intent'), form.get('next'), 'message', 'If your account needs confirmation and delivery is available, a new link can arrive. Open it in the browser that requested it. If already confirmed, sign in.'));
}

export async function logout(form?: FormData) {
  const client = await createClient();
  await client.auth.signOut();
  redirect(journeyNotice('/login', form?.get('intent'), undefined, 'message', 'You have been signed out.'));
}
