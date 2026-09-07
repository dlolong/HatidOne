export function getSupabaseEnvironment() {
  // Public references must be literal for Next.js to inline browser-safe values.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error('Configure the public Supabase URL and anon key in apps/web/.env.local.');
  return { url, anonKey };
}
