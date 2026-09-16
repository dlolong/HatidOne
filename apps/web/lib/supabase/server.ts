import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseEnvironment } from './env';

export async function createClient({ requireCookieWrite = false }: { requireCookieWrite?: boolean } = {}) {
  const cookieStore = await cookies();
  const { url, anonKey } = getSupabaseEnvironment();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch (error) {
          // Auth actions/callbacks must not claim success when persistence fails.
          if (requireCookieWrite) throw error;
          // Server Components cannot write cookies. The proxy refreshes them.
        }
      },
    },
  });
}
