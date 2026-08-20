import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), '../../supabase/migrations/0004_driver_document_recording.sql'),
  'utf8',
);

describe('document recording repair migration', () => {
  it('installs both trusted recording functions and refreshes the API schema', () => {
    expect(migration).toContain('create or replace function public.record_driver_document');
    expect(migration).toContain('create or replace function public.record_vehicle_document');
    expect(migration).toContain("notify pgrst, 'reload schema'");
  });

  it('does not allow drivers to choose verification or review fields', () => {
    expect(migration).not.toMatch(/p_verification_status|p_reviewed_by|p_reviewed_at/);
    expect(migration).toContain("verification_status = 'pending'");
  });
});
