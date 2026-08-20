function requirePublicEnvironment(name: 'NEXT_PUBLIC_SUPABASE_URL' | 'NEXT_PUBLIC_SUPABASE_ANON_KEY'): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getSupabaseEnvironment() {
  return {
    url: requirePublicEnvironment('NEXT_PUBLIC_SUPABASE_URL'),
    anonKey: requirePublicEnvironment('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  };
}
