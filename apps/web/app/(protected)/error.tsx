'use client';

export default function ProtectedAppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="large-empty">
      <h2>Something didn’t load</h2>
      <p>Check your connection and confirm the latest database migrations are applied.</p>
      <button className="button button-primary" onClick={reset} type="button">Try again</button>
    </section>
  );
}
