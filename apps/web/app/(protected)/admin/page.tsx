import Link from "next/link";
import { Dashboard, DashboardCard } from "@/components/dashboard";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export default async function AdminDashboard() {
  await requireRole("admin");
  const client = await createClient();
  const now = new Date().toISOString();
  const [unassigned, safety, reviews, active, upcoming] = await Promise.all([
    client
      .from("ride_requests")
      .select("id", { count: "exact", head: true })
      .in("status", ["requested", "searching", "offered"]),
    client
      .from("safety_reports")
      .select("id", { count: "exact", head: true })
      .neq("status", "resolved"),
    client
      .from("driver_profiles")
      .select("id", { count: "exact", head: true })
      .eq("verification_status", "under_review"),
    client
      .from("ride_requests")
      .select("id", { count: "exact", head: true })
      .in("status", ["driver_en_route", "driver_arrived", "trip_started"]),
    client
      .from("ride_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "assigned")
      .gte("scheduled_at", now),
  ]);
  if (
    [unassigned, safety, reviews, active, upcoming].some(
      (result) => result.error,
    )
  ) {
    throw new Error(
      "We couldn’t load operations. Please refresh and try again.",
    );
  }
  return (
    <Dashboard
      eyebrow="Operations"
      title="Keep every ride moving"
      description="Start with the requests that need your attention, then check trip coverage."
    >
      <DashboardCard title="Needs attention">
        <ul className="attention-list">
          <li>
            <Link href="/admin/dispatch">
              <span>Unassigned bookings</span>
              <strong>{unassigned.count ?? 0}</strong>
            </Link>
          </li>
          <li>
            <Link href="/admin/operations#safety">
              <span>Open safety reports</span>
              <span>{safety.count ? "Review reports" : "All clear"}</span>
            </Link>
          </li>
          <li>
            <Link href="/admin/operations#verification">
              <span>Driver applications to review</span>
              <strong>{reviews.count ?? 0}</strong>
            </Link>
          </li>
        </ul>
        {!unassigned.count && !safety.count && !reviews.count && (
          <p className="muted">
            Nothing needs attention right now. New requests will appear here.
          </p>
        )}
      </DashboardCard>
      <DashboardCard title="Live coverage">
        <div className="form-grid">
          <div>
            <p className="stat-value">{active.count ?? 0}</p>
            <p>Active trips</p>
          </div>
          <div>
            <p className="stat-value">{upcoming.count ?? 0}</p>
            <p>Upcoming assigned rides</p>
          </div>
        </div>
        <Link
          className="button button-primary"
          href="/admin/operations#overview"
        >
          View live operations
        </Link>
        <p className="muted">
          Check pickup readiness, driver coverage and trip progress.
        </p>
      </DashboardCard>
      <section
        className="dashboard-wide button-row"
        aria-label="Other operations tools"
      >
        <Link
          className="button button-secondary"
          href="/admin/operations#business"
        >
          Business subscriptions
        </Link>
        <Link
          className="button button-secondary"
          href="/admin/operations#system"
        >
          Configuration & audit
        </Link>
      </section>
    </Dashboard>
  );
}
