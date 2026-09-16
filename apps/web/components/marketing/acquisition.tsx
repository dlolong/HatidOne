import Link from 'next/link';
import { PublicHeader, PublicFooter } from '../public-navigation';
export function AcquisitionPage({ eyebrow, title, description, points, cta, href = '/organizations' }: { eyebrow:string; title:string; description:string; points:string[]; cta:string; href?:string }) {
  return <main className="landing-page"><PublicHeader /><section className="hero"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p><Link className="button button-primary" href={href}>{cta}</Link></section><section className="feature-grid">{points.map((point,index) => <article className="feature-card" key={point}><span>{String(index+1).padStart(2,'0')}</span><h2>{point}</h2></article>)}</section><p>HatidOne is preparing a verified mobility network. Ride availability depends on approved drivers and confirmed schedules.</p><PublicFooter /></main>;
}
