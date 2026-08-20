import { describe, expect, it } from 'vitest';
import { dashboardPathForRole, isActiveAccountStatus, isAppRole } from './roles';

describe('role helpers', () => {
  it('accepts only application roles', () => {
    expect(isAppRole('passenger')).toBe(true);
    expect(isAppRole('fleet_admin')).toBe(true);
    expect(isAppRole('support')).toBe(false);
    expect(isAppRole(undefined)).toBe(false);
  });

  it('maps trusted roles to dashboards', () => {
    expect(dashboardPathForRole('passenger')).toBe('/passenger');
    expect(dashboardPathForRole('driver')).toBe('/driver');
    expect(dashboardPathForRole('fleet_admin')).toBe('/fleet');
    expect(dashboardPathForRole('admin')).toBe('/admin');
  });

  it('allows only active accounts through authorization', () => {
    expect(isActiveAccountStatus('active')).toBe(true);
    expect(isActiveAccountStatus('pending')).toBe(false);
    expect(isActiveAccountStatus('suspended')).toBe(false);
    expect(isActiveAccountStatus('banned')).toBe(false);
    expect(isActiveAccountStatus(undefined)).toBe(false);
  });
});
