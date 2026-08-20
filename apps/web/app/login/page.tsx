import { AuthForm } from '@/components/auth-form';
import { login } from '@/app/auth/actions';

type LoginPageProps = {
  searchParams: Promise<{ error?: string; message?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  return (
    <AuthForm
      action={login}
      alternateHref="/signup"
      alternateLabel="Create an account"
      alternateText="New to HatidOne?"
      description="Access your rides and account."
      error={params.error}
      message={params.message}
      pendingLabel="Signing in…"
      submitLabel="Sign in"
      title="Welcome back"
    >
      <label>Email<input autoComplete="email" name="email" required type="email" /></label>
      <label>Password<input autoComplete="current-password" name="password" required type="password" /></label>
    </AuthForm>
  );
}
