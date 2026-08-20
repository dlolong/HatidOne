import { AuthForm } from '@/components/auth-form';
import { signup } from '@/app/auth/actions';

type SignupPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const { error } = await searchParams;
  return (
    <AuthForm
      action={signup}
      alternateHref="/login"
      alternateLabel="Sign in"
      alternateText="Already registered?"
      description="Every new account starts securely as a passenger."
      error={error}
      pendingLabel="Creating account…"
      submitLabel="Create account"
      title="Create your account"
    >
      <div className="form-grid">
        <label>First name<input autoComplete="given-name" maxLength={80} name="firstName" required /></label>
        <label>Last name<input autoComplete="family-name" maxLength={80} name="lastName" required /></label>
      </div>
      <label>Email<input autoComplete="email" name="email" required type="email" /></label>
      <label>Password<input autoComplete="new-password" minLength={8} name="password" required type="password" /></label>
    </AuthForm>
  );
}
