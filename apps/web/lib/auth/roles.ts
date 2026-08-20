export const APP_ROLES = ['passenger', 'driver', 'fleet_admin', 'admin'] as const;

export type AppRole = (typeof APP_ROLES)[number];

export function isActiveAccountStatus(value: unknown): value is 'active' {
  return value === 'active';
}

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === 'string' && APP_ROLES.some((role) => role === value);
}

export function dashboardPathForRole(role: AppRole): string {
  const paths: Record<AppRole, string> = {
    passenger: '/passenger',
    driver: '/driver',
    fleet_admin: '/fleet',
    admin: '/admin',
  };

  return paths[role];
}
