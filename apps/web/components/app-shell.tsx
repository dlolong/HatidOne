import Link from 'next/link';
import type { ReactNode } from 'react';
import { logout } from '@/app/auth/actions';
import { dashboardPathForRole, type AppRole } from '@/lib/auth/roles';

type AppShellProps = {
  children: ReactNode;
  name: string;
  role: AppRole;
};

const ROLE_LABELS: Record<AppRole, string> = {
  passenger: 'Passenger',
  driver: 'Driver',
  fleet_admin: 'Fleet admin',
  admin: 'Administrator',
};

export function AppShell({ children, name, role }: AppShellProps) {
  return (
    <div className="app-frame">
      <header className="app-header">
        <Link className="brand brand-light" href={dashboardPathForRole(role)}>HatidOne</Link>
        {role === 'passenger' ? <nav className="app-nav" aria-label="Passenger navigation"><Link href="/book">Book</Link><Link href="/history">History</Link></nav> : null}
        <div className="account-summary">
          <span><strong>{name}</strong><small>{ROLE_LABELS[role]}</small></span>
          <form action={logout}><button className="button button-header" type="submit">Sign out</button></form>
        </div>
      </header>
      <main className="app-main">{children}</main>
    </div>
  );
}
