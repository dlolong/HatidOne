'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { AppRole } from '@/lib/auth/roles';
const destinations: Record<AppRole, { label: string; href: string }[]> = {
  passenger: [{ label: 'Home', href: '/passenger' }, { label: 'Book a ride', href: '/book' }, { label: 'Bookings', href: '/history' }, { label: 'Activity', href: '/notifications' }],
  driver: [{ label: 'Jobs', href: '/driver' }, { label: 'Documents', href: '/driver/onboarding' }, { label: 'Activity', href: '/notifications' }, { label: 'Business', href: '/organizations' }],
  admin: [{ label: 'Overview', href: '/admin' }, { label: 'Dispatch', href: '/admin/dispatch' }, { label: 'Drivers', href: '/admin/drivers' }, { label: 'Operations', href: '/admin/operations' }],
  fleet_admin: [{ label: 'Fleet', href: '/fleet' }, { label: 'Business', href: '/organizations' }, { label: 'Activity', href: '/notifications' }, { label: 'Referrals', href: '/referrals' }],
};
export function AppNavigation({ role }: { role: AppRole }) {
  const path = usePathname();
  return <nav className="primary-nav" aria-label={`${role === 'admin' ? 'Operations' : 'Main'} navigation`}>{destinations[role].map(item => {
    const active = path === item.href || item.href === '/admin/drivers' && path.startsWith('/admin/drivers/') || item.href === '/organizations' && path.startsWith('/organizations/') || item.href === '/history' && path.startsWith('/booking/');
    return <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined}>{item.label}</Link>;
  })}</nav>;
}
