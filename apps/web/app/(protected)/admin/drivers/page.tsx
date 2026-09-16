import Link from 'next/link';
import { Dashboard } from '@/components/dashboard';
import { StatusPill, EmptyState } from '@/components/ui';
import { getAdminDriverQueue } from '@/lib/admin/data';
import { dateTime } from '@/lib/operations/data';
export default async function DriversPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; page?: string; error?: string; message?: string }> }) {
  const params = await searchParams;
  const queue = await getAdminDriverQueue(params);
  function pageLink(page: number) { return `/admin/drivers?${new URLSearchParams({status:queue.status,q:queue.query,page:String(page)})}`; }
  return <Dashboard eyebrow="Administration / Drivers" title="Driver applications" description="Review submitted applications, check documents and manage existing driver verification.">
    {params.error && <p className="notice notice-error dashboard-wide" role="alert">{params.error}</p>}
    {params.message && <p className="notice notice-success dashboard-wide" role="status">{params.message}</p>}
    <section className="dashboard-card dashboard-wide">
      <form className="admin-filters" method="get"><label>Search applicant<input name="q" type="search" placeholder="Email, first or last name" maxLength={80} defaultValue={queue.query}/></label><label>Application status<select name="status" defaultValue={queue.status}><option value="under_review">Awaiting review</option><option value="verified">Approved</option><option value="rejected">Changes requested</option><option value="suspended">Suspended</option><option value="all">All submitted and reviewed</option></select></label><button className="button button-primary" type="submit">Apply filters</button><Link href="/admin/drivers" className="button button-ghost">Reset</Link></form>
      <p className="muted" role="status">{queue.total} matching applications. Drafts are excluded until submitted.</p>
      {queue.pageReset && <p className="notice" role="status">That page is no longer available. Showing the first page of matching applications.</p>}
      {queue.searchLimited && <p className="notice">This search matches many accounts. Narrow it with the applicant’s email.</p>}
      {queue.drivers.length ? <div className="admin-driver-list">{queue.drivers.map(driver => <article className="admin-driver-row" key={driver.id}>
        <div><h2><Link href={`/admin/drivers/${driver.id}`}>{[driver.person?.first_name, driver.person?.last_name].filter(Boolean).join(' ') || 'Applicant'}</Link></h2><p className="wrap-anywhere">{driver.person?.email ?? 'Email unavailable'}</p><small>{driver.preferred_area || 'Service area not recorded'} · Started {dateTime(driver.created_at)}</small></div>
        <div><StatusPill status={driver.verification_status}/>{driver.person?.account_status !== 'active' && <p className="notice notice-error">Account restricted</p>}<p>{driver.online ? 'Online' : 'Offline'}</p><Link className="button button-secondary" href={`/admin/drivers/${driver.id}`}>Review application</Link></div>
      </article>)}</div> : <EmptyState title={queue.query || queue.status !== 'under_review' ? 'No matching applications' : 'No applications awaiting review'}>Try another filter, or return when an applicant submits their details.</EmptyState>}
      {(queue.page > 1 || queue.total > queue.pageSize) && <nav className="button-row admin-pagination" aria-label="Application pages">{queue.page > 1 && <Link className="button button-secondary" href={pageLink(queue.page-1)}>Previous</Link>}<span>Page {queue.page} · {queue.pageSize} per page</span>{queue.page*queue.pageSize < queue.total && <Link className="button button-secondary" href={pageLink(queue.page+1)}>Next</Link>}</nav>}
    </section>
  </Dashboard>;
}
