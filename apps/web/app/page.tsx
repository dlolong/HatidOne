import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="landing-page">
      <nav className="landing-nav">
        <span className="brand">HatidOne</span>
        <Link className="button button-secondary" href="/login">Sign in</Link>
      </nav>
      <section className="hero">
        <p className="eyebrow">Scheduled rides, made dependable</p>
        <h1>Your next ride starts with clarity.</h1>
        <p>Book planned transportation and keep every important trip detail in one secure place.</p>
        <div className="button-row">
          <Link className="button button-primary" href="/signup">Create passenger account</Link>
          <Link className="button button-ghost" href="/login">I already have an account</Link>
        </div>
      </section>
      <section className="feature-grid" aria-label="HatidOne account types">
        <article className="feature-card"><span>01</span><h2>Passengers</h2><p>Manage scheduled rides from a simple mobile-first dashboard.</p></article>
        <article className="feature-card"><span>02</span><h2>Drivers</h2><p>See onboarding status and prepare for eligible ride offers.</p></article>
        <article className="feature-card"><span>03</span><h2>Operations</h2><p>Dedicated fleet and administration workspaces keep access separated.</p></article>
      </section>
    </main>
  );
}
