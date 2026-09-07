import { safeReturnPath } from '@/lib/auth/redirects';
import { AuthForm } from '@/components/auth-form';
import { signup } from '@/app/auth/actions';

type SignupPageProps = {
  searchParams: Promise<{ error?: string; next?: string }>;
};

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const { error, next } = await searchParams;
  return (
    <AuthForm
      action={signup}
      alternateHref={`/login?next=${encodeURIComponent(safeReturnPath(next))}`}
      alternateLabel="Sign in"
      alternateText="Already registered?"
      description="Book your first ride with a few simple details."
      error={error}
      pendingLabel="Creating account…"
      submitLabel="Create account"
      title="Create your account"
    >
      <input type="hidden" name="next" value={safeReturnPath(next)} />
      <div className="form-grid">
        <label>First name<input autoComplete="given-name" maxLength={80} name="firstName" required /></label>
        <label>Last name<input autoComplete="family-name" maxLength={80} name="lastName" required /></label>
      </div>
      <label>Email<input autoComplete="email" name="email" required type="email" /></label>
      <label>Password<input aria-describedby="password-help" autoComplete="new-password" minLength={8} name="password" required type="password" /></label><small className="muted" id="password-help">Use at least 8 characters.</small>
    </AuthForm>
  );
}
