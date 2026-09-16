import Link from 'next/link';
import { logout } from '../actions';

export default async function ProfileErrorPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const restricted = (await searchParams).reason === 'inactive-account';
  return (
    <main className="center-page">
      <section className="auth-card">
        <p className="eyebrow">{restricted ? 'Account status' : 'Account setup'}</p>
        <h1>{restricted ? 'Account access restricted' : 'We couldn’t load your profile'}</h1>
        <p className="muted">{restricted ? 'This account cannot book or start a new driver application while access is restricted. Contact the operations representative managing your account for the available review process.' : 'Your account is signed in, but its HatidOne profile is unavailable. Retry, or contact your operator if the issue continues. You do not need to create another account.'}</p>
        <div className="button-row">
          <Link className="button button-secondary" href="/dashboard">Try again</Link>
          <form action={logout}><button className="button button-ghost" type="submit">Sign out</button></form>
        </div>
      </section>
    </main>
  );
}
