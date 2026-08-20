'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { authCallbackUrl } from '@/lib/auth/redirects';

function requiredText(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function authError(path: '/login' | '/signup', message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

export async function login(formData: FormData) {
  const email = requiredText(formData, 'email');
  const password = requiredText(formData, 'password');
  if (!email || !password) authError('/login', 'Email and password are required.');

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) authError('/login', 'Unable to sign in. Check your email and password.');
  redirect('/dashboard');
}

export async function signup(formData: FormData) {
  const firstName = requiredText(formData, 'firstName');
  const lastName = requiredText(formData, 'lastName');
  const email = requiredText(formData, 'email');
  const password = requiredText(formData, 'password');

  if (!firstName || !lastName || !email || !password) {
    authError('/signup', 'All fields are required.');
  }
  if (password.length < 8) authError('/signup', 'Password must be at least 8 characters.');

  // Never derive an email destination from request headers: Host/Origin are
  // attacker-controlled in some proxy deployments and can poison auth links.
  const emailRedirectTo = authCallbackUrl(process.env.NEXT_PUBLIC_SITE_URL);
  if (!emailRedirectTo) authError('/signup', 'Account confirmation is not configured.');

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { first_name: firstName, last_name: lastName },
      emailRedirectTo,
    },
  });

  if (error) authError('/signup', 'Unable to create your account. Please try again.');
  if (data.session) redirect('/dashboard');
  redirect('/login?message=Check%20your%20email%20to%20confirm%20your%20account.');
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login?message=You%20have%20been%20signed%20out.');
}
