import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseEnvironment } from './env';

const recoveryCookieName = 'hatidone-recovery';
function secureRecoveryCookie(): boolean {
  try { return new URL(process.env.NEXT_PUBLIC_SITE_URL ?? '').protocol === 'https:'; }
  catch { return true; }
}

// Recovery never reads or overwrites the normal application session. Only the
// server exchanges its PKCE code and uses these HttpOnly recovery cookies.
export async function createRecoveryClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = getSupabaseEnvironment();
  return createServerClient(url, anonKey, {
    cookieOptions: {
      name: recoveryCookieName,
      httpOnly: true,
      secure: secureRecoveryCookie(),
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60,
    },
    cookies: {
      getAll: () => cookieStore.getAll().filter(cookie => cookie.name.startsWith(recoveryCookieName)),
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          try {
            // @supabase/ssr applies its long default maxAge when persisting;
            // enforce recovery cookie lifetime at the actual write boundary.
            cookieStore.set(name, value, {
              ...options,
              httpOnly: true,
              secure: secureRecoveryCookie(),
              sameSite: 'lax',
              path: '/',
              maxAge: options.maxAge === 0 ? 0 : 15 * 60,
            });
          }
          catch { /* Server component reads cannot write cookies; actions/callbacks can. */ }
        }
      },
    },
  });
}

export async function clearRecoveryCookies() {
  const cookieStore = await cookies();
  for (const cookie of cookieStore.getAll()) {
    if (cookie.name.startsWith(recoveryCookieName)) cookieStore.delete(cookie.name);
  }
}
