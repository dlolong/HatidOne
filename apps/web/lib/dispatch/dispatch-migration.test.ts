import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const dispatchMigration = readFileSync(
  resolve(process.cwd(), '../../supabase/migrations/0005_dispatch.sql'),
  'utf8',
);
const initialMigration = readFileSync(
  resolve(process.cwd(), '../../supabase/migrations/0001_initial.sql'),
  'utf8',
);

function functionBody(name: string): string {
  const start = dispatchMigration.indexOf(`function public.${name}`);
  const next = dispatchMigration.indexOf('create or replace function public.', start + 20);
  return dispatchMigration.slice(start, next === -1 ? undefined : next);
}

describe('deterministic dispatch migration', () => {
  it('enforces every eligibility requirement with PostGIS proximity', () => {
    const body = functionBody('find_eligible_drivers');
    expect(body).toContain("verification_status = 'verified'");
    expect(body).toContain('profile.account_status = \'active\'');
    expect(body).toContain('dp.online');
    expect(body).toContain('v.active and v.verified and v.vehicle_type = rr.vehicle_type');
    expect(body).toContain('public.st_dwithin');
  });

  it('prevents two concurrent acceptances from winning the same ride', () => {
    const body = functionBody('accept_ride_offer');
    const rideLock = body.indexOf('where id = target_ride_id for update');
    const assignmentInsert = body.indexOf('insert into public.ride_assignments');
    expect(rideLock).toBeGreaterThan(-1);
    expect(assignmentInsert).toBeGreaterThan(rideLock);
    expect(initialMigration).toContain('ride_request_id uuid not null unique references public.ride_requests');
  });

  it('serializes passenger cancellation against acceptance using the same first lock', () => {
    const acceptance = functionBody('accept_ride_offer');
    const cancellation = functionBody('cancel_own_ride_request');
    expect(acceptance).toContain('where id = target_ride_id for update');
    expect(cancellation).toContain('where id = p_ride_request_id and passenger_id = auth.uid() for update');
    expect(cancellation.indexOf('for update')).toBeLessThan(cancellation.indexOf("set status = 'passenger_cancelled'"));
  });

  it('keeps assignment and offer writes behind trusted functions', () => {
    expect(dispatchMigration).toContain('revoke all on table public.ride_offers from anon, authenticated;');
    expect(dispatchMigration).toContain('revoke all on table public.ride_assignments from anon, authenticated;');
    expect(dispatchMigration).not.toMatch(/grant (insert|update|delete).*ride_(offers|assignments).*authenticated/);
  });
});
