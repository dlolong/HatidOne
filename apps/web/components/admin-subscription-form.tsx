'use client';
import { useState } from 'react';
import type { Organization, Plan, Subscription } from '@/lib/operations/data';
import { manageSubscription } from '@/app/(protected)/admin/operations/actions';
import { SubmitButton } from './submit-button';
export function AdminSubscriptionForm({ organizations, plans, subscriptions }: { organizations: Organization[]; plans: Plan[]; subscriptions: Subscription[] }) {
  const [organizationId, setOrganizationId] = useState(organizations[0]?.id ?? '');
  const organization = organizations.find(item => item.id === organizationId);
  const available = plans.filter(plan => plan.audience === organization?.kind);
  const current = subscriptions.find(item => item.organization_id === organizationId);
  if (!organizations.length) return <p>Create a business account before recording a subscription.</p>;
  const expiration = current?.expires_at ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(current.expires_at)) : '';
  return <form action={manageSubscription} className="compact-form">
    <label>Business<select name="organization_id" value={organizationId} onChange={event=>setOrganizationId(event.target.value)} required>{organizations.map(item=><option key={item.id} value={item.id}>{item.name} · {item.kind}</option>)}</select></label>
    <div key={organizationId} className="compact-form">
      <label>Plan<select name="plan_id" required defaultValue={available.some(plan=>plan.id===current?.plan_id)?current?.plan_id:''}><option value="" disabled>Choose a compatible plan</option>{available.map(plan=><option value={plan.id} key={plan.id}>{plan.display_name}</option>)}</select></label>
      {!available.length && <p className="notice">No active plan is available for this business type.</p>}
      <div className="form-grid"><label>Status<select name="status" defaultValue={current?.status ?? 'trial'}>{['trial','active','past_due','cancelled','expired'].map(status=><option key={status} value={status}>{status.replaceAll('_',' ')}</option>)}</select></label><label>Expiration (Philippines)<input type="date" name="expires_at" defaultValue={expiration} required/></label><label>Manual billing<select name="billing_status" defaultValue={current?.billing_status ?? 'manual_due'}><option value="manual_due">Manual payment due</option><option value="settled">Settled</option><option value="waived">Waived</option></select></label></div>
    </div>
    <SubmitButton pendingLabel="Updating…" disabled={!available.length}>Update subscription</SubmitButton>
  </form>;
}
