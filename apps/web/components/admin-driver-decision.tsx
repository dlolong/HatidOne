'use client';
import { useState } from 'react';
import { reviewDriver } from '@/app/(protected)/admin/operations/actions';
import { ConfirmForm } from './confirm-form';
import { SubmitButton } from './submit-button';
export function AdminDriverDecision({ id, status, approvalBlocked }: { id: string; status: string; approvalBlocked: boolean }) {
  const [decision, setDecision] = useState('');
  if (status === 'pending') return <p>This application is still a draft. Wait for the applicant to submit before recording a review.</p>;
  const canApprove = ['under_review','verified','suspended'].includes(status) && !approvalBlocked;
  return <ConfirmForm action={reviewDriver} message="Record this driver review decision? The applicant will receive the updated status.">
    <input type="hidden" name="driver_id" value={id}/><input type="hidden" name="return_to" value="driver"/>
    <label>Review decision<select name="decision" value={decision} onChange={event=>setDecision(event.target.value)} required><option value="" disabled>Choose a decision</option>{canApprove && <option value="verified">{status==='suspended'?'Reinstate after review':'Approve verification'}</option>}<option value="rejected">Request corrections</option><option value="suspended">Suspend driver access</option></select></label>
    <label>{decision === 'verified' ? 'Review note (optional)' : 'Reason shown to applicant'}<textarea name="reason" minLength={decision==='verified'?undefined:3} maxLength={1000} required={decision!=='verified'}/></label>
    <p className="muted">Use a clear, actionable reason. Approval does not put the driver online; account, vehicle, document and trip eligibility are checked separately.</p>
    <SubmitButton disabled={!decision} pendingLabel="Saving review…">Save review decision</SubmitButton>
  </ConfirmForm>;
}
