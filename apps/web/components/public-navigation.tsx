import Link from 'next/link';
export function PublicHeader() {
  return <header className="landing-nav public-header"><Link className="brand" href="/">HatidOne</Link>
    <nav className="public-primary-nav" aria-label="Explore HatidOne"><Link href="/signup?intent=passenger">Book a ride</Link><Link className="public-driver-link" href="/signup?intent=driver">Apply to drive</Link><Link className="public-business-link" href="/business">Business rides</Link></nav>
    <Link className="button button-secondary" href="/login">Sign in</Link>
  </header>;
}
export function PublicFooter() {
  return <footer className="public-footer"><Link className="brand" href="/">HatidOne</Link><nav aria-label="Footer navigation"><Link href="/signup?intent=passenger">Book a ride</Link><Link href="/signup?intent=driver">Apply to drive</Link><Link href="/drivers">Driver information</Link><Link href="/fleets">Fleets</Link><Link href="/partners/resorts">Resort partners</Link><Link href="/business">Business rides</Link></nav></footer>;
}
