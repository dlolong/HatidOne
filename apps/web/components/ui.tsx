import type { ReactNode } from 'react';
import { bookingStatusPresentation } from '@/lib/booking/booking';

const labels: Record<string, string> = {
  pending: 'Pending', under_review: 'Under review', verified: 'Verified', rejected: 'Changes requested', suspended: 'Suspended',
  active: 'Active', inactive: 'Inactive', trial: 'Trial', past_due: 'Payment due', cancelled: 'Cancelled', expired: 'Expired',
  manual_due: 'Payment due', settled: 'Settled', waived: 'Waived', offline: 'Offline', available: 'Available', ready: 'Ready',
};
export function StatusPill({ status, label }: { status: string; label?: string }) {
  const known = bookingStatusPresentation(status);
  const tone = ['verified','active','available','trip_completed','settled','waived'].includes(status) ? 'success'
    : ['rejected','suspended','cancelled','passenger_cancelled','driver_cancelled','no_show'].includes(status) ? 'danger'
    : ['pending','under_review','past_due','manual_due','expired','requested','searching','offered'].includes(status) ? 'warning' : 'neutral';
  return <span className={`status-pill badge-${tone}`}>{label ?? labels[status] ?? known.label}</span>;
}
export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return <section className="large-empty"><h2>{title}</h2>{children && <p>{children}</p>}{action}</section>;
}
export function LoadingSkeleton({ label = 'Loading your workspace…' }: { label?: string }) {
  return <section className="workspace-skeleton" role="status" aria-label={label} aria-busy="true"><p className="muted">{label}</p><div className="skeleton skeleton-title" /><div className="skeleton-grid">{[0,1,2].map(item => <div className="skeleton-card" key={item}><div className="skeleton" /><div className="skeleton" /><div className="skeleton" /></div>)}</div></section>;
}
