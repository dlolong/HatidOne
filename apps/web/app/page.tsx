import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="landing-page">
      <header className="landing-nav">
        <span className="brand">HatidOne</span>
        <nav className="app-nav" aria-label="Explore HatidOne"><Link href="/drivers">Drive</Link><Link href="/fleets">Fleets</Link><Link href="/partners/resorts">Partners</Link><Link href="/business">Business</Link></nav>
        <Link className="button button-secondary" href="/login">Sign in</Link>
      </header>
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
        <article className="feature-card"><span>01</span><h2>Passengers</h2><p>Book ahead, meet your driver and follow your trip in one place.</p></article>
        <article className="feature-card"><span>02</span><h2>Drivers</h2><p>See onboarding status and prepare for eligible ride offers.</p></article>
        <article className="feature-card"><span>03</span><h2>Operations</h2><p>Coordinate drivers, guest transfers and employee rides with clear schedules.</p></article>
      </section>
    </main>
  );
}
