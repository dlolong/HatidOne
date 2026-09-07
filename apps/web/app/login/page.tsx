import { safeReturnPath } from '@/lib/auth/redirects';
import { AuthForm } from '@/components/auth-form';
import { login } from '@/app/auth/actions';

type LoginPageProps = {
  searchParams: Promise<{ error?: string; message?: string; next?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  return (
    <AuthForm
      action={login}
      alternateHref={`/signup?next=${encodeURIComponent(safeReturnPath(params.next))}`}
      alternateLabel="Create an account"
      alternateText="New to HatidOne?"
      description="Access your rides and account."
      error={params.error}
      message={params.message}
      pendingLabel="Signing in…"
      submitLabel="Sign in"
      title="Welcome back"
    >
      <input type="hidden" name="next" value={safeReturnPath(params.next)} />
      <label>Email<input aria-describedby={params.error ? "auth-error" : undefined} aria-invalid={!!params.error} autoComplete="email" name="email" required type="email" /></label>
      <label>Password<input aria-describedby={params.error ? "auth-error" : undefined} aria-invalid={!!params.error} autoComplete="current-password" name="password" required type="password" /></label>
    </AuthForm>
  );
}
