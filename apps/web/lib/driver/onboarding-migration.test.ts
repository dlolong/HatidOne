import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), '../../supabase/migrations/0003_driver_onboarding.sql'),
  'utf8',
);

describe('driver onboarding migration security', () => {
  it('keeps document buckets private and scopes paths to the authenticated user', () => {
    expect(migration).toContain("('driver-documents', 'driver-documents', false");
    expect(migration).toContain("('vehicle-documents', 'vehicle-documents', false");
    expect(migration).toContain('(storage.foldername(name))[1] = auth.uid()::text');
  });

  it('does not grant review or verification fields to drivers', () => {
    expect(migration).toContain('grant update (preferred_area) on table public.driver_profiles');
    expect(migration).toContain('grant update (storage_path, expires_on) on table public.driver_documents');
    expect(migration).not.toMatch(/grant update \([^)]*verification_status/);
    expect(migration).not.toMatch(/grant update \([^)]*reviewed_by/);
  });

  it('allows submission only into review, never verification', () => {
    expect(migration).toContain("set verification_status = 'under_review'");
    expect(migration).not.toContain("set verification_status = 'verified'");
  });
});
