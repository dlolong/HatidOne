import Link from 'next/link';
import { logout } from '../actions';

export default function ProfileErrorPage() {
  return (
    <main className="center-page">
      <section className="auth-card">
        <p className="eyebrow">Account setup</p>
        <h1>We couldn’t load your profile</h1>
        <p className="muted">Your account is signed in, but its HatidOne profile is unavailable. Apply the latest database migration, then try again.</p>
        <div className="button-row">
          <Link className="button button-secondary" href="/dashboard">Try again</Link>
          <form action={logout}><button className="button button-ghost" type="submit">Sign out</button></form>
        </div>
      </section>
    </main>
  );
}
