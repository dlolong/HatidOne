import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), '../../supabase/migrations/0006_security_hardening.sql'),
  'utf8',
);

describe('security hardening migration', () => {
  it('removes direct client writes to protected lifecycle and document tables', () => {
    expect(migration).toContain('revoke all on table public.ride_requests from anon, authenticated');
    expect(migration).toContain('revoke all on table public.driver_documents from anon, authenticated');
    expect(migration).toContain('revoke all on table public.vehicle_documents from anon, authenticated');
  });

  it('allows active operations users to review private document metadata and objects', () => {
    expect(migration).toContain('operations_read_driver_document_metadata');
    expect(migration).toContain('operations_read_vehicle_document_metadata');
    expect(migration).toContain('operations_read_private_documents');
    expect(migration).toContain("role in ('admin'::public.user_role, 'support'::public.user_role)");
  });

  it('requires document metadata to reference an owned private storage object', () => {
    expect(migration).toContain('create or replace function public.verify_private_document_object()');
    expect(migration).toContain('owner_id = expected_owner::text');
    expect(migration).toContain("expected_bucket := 'driver-documents'");
    expect(migration).toContain("expected_bucket := 'vehicle-documents'");
  });

  it('prevents deletion of referenced documents and validates submission objects', () => {
    expect(migration).toContain('drivers_delete_unreferenced_private_documents');
    expect(migration).toContain('not exists (\n    select 1 from public.driver_documents where storage_path = name');
    expect(migration).toContain("join storage.objects object on object.bucket_id = 'driver-documents'");
    expect(migration).toContain("join storage.objects object on object.bucket_id = 'vehicle-documents'");
  });

  it('enforces one primary vehicle per driver', () => {
    expect(migration).toContain('create unique index if not exists driver_vehicles_one_primary_idx');
    expect(migration).toContain('on public.driver_vehicles(driver_id) where is_primary');
  });
});
