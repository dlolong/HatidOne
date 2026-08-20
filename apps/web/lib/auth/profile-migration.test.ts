import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), '../../supabase/migrations/0002_profile_bootstrap.sql'),
  'utf8',
);

describe('profile bootstrap migration', () => {
  it('forces public signups to the passenger role and active status', () => {
    expect(migration).toContain("'passenger'::public.user_role");
    expect(migration).toContain("'active'::public.account_status");
    expect(migration).not.toMatch(/raw_user_meta_data\s*->>\s*'role'/);
    expect(migration).not.toMatch(/raw_user_meta_data\s*->>\s*'account_status'/);
  });

  it('does not grant authenticated users control of privileged profile columns', () => {
    expect(migration).toContain('revoke update on table public.profiles from anon, authenticated;');
    expect(migration).toContain(
      'grant update (first_name, last_name, phone, avatar_url) on table public.profiles to authenticated;',
    );
  });
});
