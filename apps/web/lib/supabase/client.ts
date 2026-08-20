'use client';

import { createBrowserClient } from '@supabase/ssr';
import { getSupabaseEnvironment } from './env';

export function createClient() {
  const { url, anonKey } = getSupabaseEnvironment();
  return createBrowserClient(url, anonKey);
}
