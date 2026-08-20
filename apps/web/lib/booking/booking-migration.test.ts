import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), '../../supabase/migrations/0004_passenger_booking.sql'),
  'utf8',
);

describe('passenger booking migration security', () => {
  it('removes direct ride writes and calculates fare in trusted SQL', () => {
    expect(migration).toContain('revoke all on table public.ride_requests from anon, authenticated;');
    expect(migration).toContain('public.placeholder_scheduled_fare');
    expect(migration).not.toMatch(/p_estimated_fare|p_status/);
  });

  it('binds ownership to auth uid and makes creation idempotent', () => {
    expect(migration).toContain('auth.uid(), p_client_request_id');
    expect(migration).toContain('pg_catalog.pg_advisory_xact_lock');
    expect(migration).toContain('ride_requests_passenger_request_key');
  });

  it('locks cancellation and writes immutable audit events', () => {
    expect(migration).toContain('for update;');
    expect(migration).toContain("set status = 'passenger_cancelled'");
    expect(migration).toContain('revoke all on table public.ride_request_events from anon, authenticated;');
  });
});
