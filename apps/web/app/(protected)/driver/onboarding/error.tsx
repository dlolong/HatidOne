'use client';

export default function OnboardingError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="auth-card">
      <p className="eyebrow">Driver onboarding</p>
      <h1>We couldn’t load onboarding</h1>
      <p className="muted">Check your connection and confirm the latest Supabase migration has been applied.</p>
      <button className="button button-primary" onClick={reset} type="button">Try again</button>
    </section>
  );
}
