export default function HomePage() {
  return (
    <main style={{ maxWidth: 920, margin: '0 auto', padding: 32 }}>
      <h1 style={{ marginBottom: 8 }}>HatidOne</h1>
      <p style={{ marginTop: 0 }}>Scheduled transportation marketplace starter.</p>

      <section style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginTop: 28 }}>
        {[
          ['Passenger', 'Create and manage scheduled ride requests.'],
          ['Driver', 'Review eligible bookings and assigned trips.'],
          ['Fleet', 'Manage vehicles, drivers, and manual dispatch.'],
          ['Admin', 'Approve, monitor, and support platform operations.']
        ].map(([title, text]) => (
          <article key={title} style={{ background: '#fff', padding: 20, borderRadius: 14, boxShadow: '0 8px 28px rgba(20,30,50,.08)' }}>
            <h2 style={{ marginTop: 0 }}>{title}</h2>
            <p>{text}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
