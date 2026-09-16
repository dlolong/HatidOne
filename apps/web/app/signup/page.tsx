import { SignupJourney } from '@/components/signup-journey';
export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string; intent?: string }> }) {
  const params = await searchParams;
  return <SignupJourney error={params.error} />;
}
