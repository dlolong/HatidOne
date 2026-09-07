'use client';

export default function ProtectedAppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="large-empty">
      <h2>Something didn’t load</h2>
      <p>Check your connection and try again. If the problem continues, contact HatidOne support.</p>
      <button className="button button-primary" onClick={reset} type="button">Try again</button>
    </section>
  );
}
