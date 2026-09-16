'use client';
import Link from 'next/link';
export default function AdminError({ reset }: { reset: () => void }) {
  return <section className="detail-card"><p className="eyebrow">Administration</p><h1>This workspace couldn’t be loaded</h1><p role="alert">The latest records are unavailable. Please retry before making a decision.</p><div className="button-row"><button type="button" className="button button-primary" onClick={reset}>Try again</button><Link className="button button-secondary" href="/admin">Admin overview</Link></div></section>;
}
