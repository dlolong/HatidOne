'use client';
import { useSearchParams } from 'next/navigation';
import { signup } from '@/app/auth/actions';
import { authJourneyHref, journeyDestination, parseIntent } from '@/lib/auth/journey';
import { AuthForm } from './auth-form';
import { PasswordField } from './password-field';
type Intent = 'passenger' | 'driver';
export function SignupJourney({ error }: { error?: string }) {
  const query = useSearchParams();
  const intent = parseIntent(query.get('intent'));
  const next = query.get('next') ?? undefined;
  function choose(value: Intent) {
    // Intent is only navigation context. Preserve it on reload without storing account inputs or passwords.
    window.history.replaceState(null, '', authJourneyHref('/signup', value, next));
  }
  return <AuthForm action={signup}
    title={intent === 'driver' ? 'Start your driver application' : intent === 'passenger' ? 'Create your passenger account' : 'Create your account'}
    description={intent === 'driver' ? 'Creating an account starts your application. You can accept trips only after approval.' : intent === 'passenger' ? 'Book and manage your trips with one HatidOne account.' : 'Choose what you would like to do first.'}
    submitLabel={intent === 'driver' ? 'Create account and continue' : 'Create account'} pendingLabel="Creating account…" submitDisabled={!intent}
    alternateText="Already have an account?" alternateLabel="Sign in" alternateHref={authJourneyHref('/login', intent, next)} error={error}>
    <fieldset className="journey-choices"><legend>How will you use HatidOne?</legend>
      <label className={intent === 'passenger' ? 'journey-choice selected' : 'journey-choice'}><input name="intent" type="radio" value="passenger" checked={intent === 'passenger'} onChange={() => choose('passenger')} required /><span><strong>I need a ride</strong><small>Create an account to book and manage your trips.</small></span></label>
      <label className={intent === 'driver' ? 'journey-choice selected' : 'journey-choice'}><input name="intent" type="radio" value="driver" checked={intent === 'driver'} onChange={() => choose('driver')} required /><span><strong>I want to drive</strong><small>Create an account and complete your driver application.</small></span></label>
    </fieldset>
    <input type="hidden" name="next" value={journeyDestination(intent, next)} />
    <div className="form-grid"><label>First name<input autoComplete="given-name" maxLength={80} name="firstName" required /></label><label>Last name<input autoComplete="family-name" maxLength={80} name="lastName" required /></label></div>
    <label>Email<input autoComplete="email" name="email" required type="email" /></label>
    <PasswordField autoComplete="new-password" minLength={8} describedBy="password-help" />
    <small className="muted" id="password-help">Use at least 8 characters.</small>
    {!intent && <p className="muted">Select riding or driving before creating your account. This choice does not grant driver approval.</p>}
  </AuthForm>;
}
