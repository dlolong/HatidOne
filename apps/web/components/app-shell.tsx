import Link from 'next/link';
import type { ReactNode } from 'react';
import { AppNavigation } from './app-navigation';
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
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="app-header">
        <Link className="brand brand-light" href={dashboardPathForRole(role)}>HatidOne</Link>
        <AppNavigation role={role} />
        <details className="account-menu"><summary>More</summary><div className="account-menu-content"><Link href="/account">{role === 'admin' ? 'Administrator account' : 'Your account'}</Link>{['passenger', 'driver'].includes(role) && <Link href="/driver-application">Driver application</Link>}<Link href="/organizations">Business accounts</Link><Link href="/notifications">Notifications</Link><Link href="/referrals">Referrals</Link></div></details>
        <div className="account-summary">
          <span><strong>{name}</strong><small>{ROLE_LABELS[role]}</small></span>
          <form action={logout}><button className="button button-header" type="submit">Sign out</button></form>
        </div>
      </header>
      <main className="app-main" id="main-content">{children}</main>
    </div>
  );
}
