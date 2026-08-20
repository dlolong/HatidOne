import type { ReactNode } from 'react';

type DashboardProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
};

export function Dashboard({ eyebrow, title, description, children }: DashboardProps) {
  return (
    <div className="dashboard">
      <header className="dashboard-heading">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </header>
      <section className="dashboard-grid">{children}</section>
    </div>
  );
}

export function DashboardCard({ title, children }: { title: string; children: ReactNode }) {
  return <article className="dashboard-card"><h2>{title}</h2>{children}</article>;
}
