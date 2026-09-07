import Link from 'next/link';
export default function SetupPage() {
  return <main className="landing-page"><p className="eyebrow">Local development</p><h1>Connect your HatidOne backend</h1><p>Public pages are ready. Booking and account tools need the existing Supabase backend or a local Supabase instance.</p><ol><li>Start local Supabase with <code>npm run backend:start</code>.</li><li>Copy <code>.env.example</code> to <code>apps/web/.env.local</code>.</li><li>Set the public Supabase URL and anon key from <code>npx supabase status</code>, then restart the web app.</li></ol><p>No maps, payment, SMS, push or AI keys are required.</p><Link href="/">Return home</Link></main>;
}
