import Link from "next/link";
import { AdminSubscriptionForm } from "@/components/admin-subscription-form";
import { NeedsAttention } from "@/components/needs-attention";
import { releaseCapabilities, isIsolatedDemoEnvironment } from "@/lib/operations/capabilities";
import { randomUUID } from "node:crypto";
import { OperationsRideList } from "@/components/operations-ride-list";
import { WorkspaceTabs } from "@/components/workspace-tabs";
import { StatusPill, EmptyState } from "@/components/ui";
import { Dashboard, DashboardCard } from "@/components/dashboard";
import { ConfirmForm } from "@/components/confirm-form";
import { SubmitButton } from "@/components/submit-button";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  dateTime,
  type Plan,
  type Subscription,
  type Organization,
} from "@/lib/operations/data";
import {
  setReleaseControls,
  activateBackup,
  resolveSafety,
  setBackup,
  simulatePayment,
  updateConfiguration,
} from "./actions";
export default async function OperationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  await requireRole("admin");
  const client = await createClient();
  const alerts = await searchParams;
  const [
    rides,
    drivers,
    orgs,
    subscriptions,
    plans,
    config,
    backups,
    safety,
    audits,
  ] = await Promise.all([
    client
      .from("ride_requests")
      .select("id,pickup_address,dropoff_address,scheduled_at,status")
      .in("status", [
        "requested",
        "searching",
        "offered",
        "assigned",
        "driver_en_route",
        "driver_arrived",
        "trip_started",
        "no_show",
      ])
      .order("scheduled_at")
      .limit(100),
    client
      .from("driver_profiles")
      .select("id", { count: "exact", head: true })
      .eq("verification_status", "under_review"),
    client
      .from("organizations")
      .select("id,kind,name,owner_user_id,partner_type")
      .returns<Organization[]>(),
    client
      .from("organization_subscriptions")
      .select("id,organization_id,plan_id,status,expires_at,billing_status")
      .returns<Subscription[]>(),
    client
      .from("subscription_plans")
      .select("id,audience,display_name,features,monthly_price_php")
      .eq("active", true)
      .returns<Plan[]>(),
    client.from("app_config").select("*").single(),
    client
      .from("backup_assignments")
      .select("id,ride_request_id,driver_id,vehicle_id,status")
      .eq("status", "ready"),
    client
      .from("safety_reports")
      .select("id,ride_request_id,category,details,status,created_at")
      .neq("status", "resolved")
      .order("created_at"),
    client
      .from("audit_events")
      .select("id,action,entity_type,entity_id,created_at")
      .order("created_at", { ascending: false })
      .limit(30),
  ]);
  if (
    [
      rides,
      drivers,
      orgs,
      subscriptions,
      plans,
      config,
      backups,
      safety,
      audits,
    ].some((result) => result.error)
  )
    throw new Error(
      "We couldn’t load operations. Please refresh and try again.",
    );
  const queue = rides.data ?? [];
  const settings = config.data;
  return (
    <Dashboard
      eyebrow="Operations"
      title="Keep scheduled trips dependable"
      description="Review exceptions, confirm coverage and manage the business network."
    >
      {alerts.error && (
        <p className="notice notice-error dashboard-wide" role="alert">
          {alerts.error}
        </p>
      )}
      {alerts.message && (
        <p className="notice notice-success dashboard-wide" role="status">
          {alerts.message}
        </p>
      )}
      <WorkspaceTabs
        label="Operations sections"
        sections={[
          {
            id: "overview",
            label: "Overview",
            content: (
              <>
                <NeedsAttention />
                <DashboardCard title="Booking exceptions">
                  <p>
                    {
                      queue.filter((ride) =>
                        ["requested", "searching", "offered"].includes(
                          ride.status,
                        ),
                      ).length
                    }{" "}
                    unassigned ·{" "}
                    {
                      queue.filter((ride) =>
                        [
                          "driver_en_route",
                          "driver_arrived",
                          "trip_started",
                        ].includes(ride.status),
                      ).length
                    }{" "}
                    active trips
                  </p>
                  <p>
                    {queue.filter((ride) => ride.status === "no_show").length}{" "}
                    no-shows · {(safety.data ?? []).length} open safety reports
                  </p>
                  <Link href="/admin/dispatch">Open dispatch queue</Link>
                </DashboardCard>
                <DashboardCard title="Network readiness">
                  <p><strong>{drivers.count ?? 0}</strong> submitted applications awaiting review.</p>
                  <p>
                    {
                      (orgs.data ?? []).filter((org) => org.kind === "fleet")
                        .length
                    }{" "}
                    fleets ·{" "}
                    {
                      (orgs.data ?? []).filter((org) => org.kind === "partner")
                        .length
                    }{" "}
                    partners ·{" "}
                    {
                      (orgs.data ?? []).filter(
                        (org) => org.kind === "corporate",
                      ).length
                    }{" "}
                    corporate accounts
                  </p>
                  <Link href="/organizations">Business accounts</Link>
                </DashboardCard>
                <p className="muted dashboard-wide">Showing up to 100 open bookings, earliest pickup first. Overview totals include all matching bookings.</p><OperationsRideList rides={queue} />
              </>
            ),
          },
          {
            id: "verification",
            label: "Verification",
            content: (
              <>
                <section
                  className="dashboard-card dashboard-wide"
                  id="verification"
                >
                  <h2>Driver verification</h2>
                  <p>Review applicant details, vehicles and private documents in the driver application queue. Incomplete drafts are excluded before pagination.</p>
                  <p><strong>{drivers.count ?? 0}</strong> submitted applications awaiting review.</p>
                  <div className="button-row"><Link className="button button-primary" href="/admin/drivers">Review applications</Link><Link className="button button-secondary" href="/admin/drivers?status=all">All submitted drivers</Link></div>
                </section>
              </>
            ),
          },
          {
            id: "safety",
            label: "Safety & backup",
            content: (
              <>
                <section className="dashboard-card">
                  <h2>Safety reports</h2>
                  {(safety.data ?? []).length ? (
                    (safety.data ?? []).map((report) => (
                      <details key={report.id}>
                        <summary>
                          {report.category[0].toUpperCase() +
                            report.category.slice(1)}{" "}
                          ·{" "}
                          <StatusPill
                            status={report.status}
                            label={
                              report.status === "reviewing"
                                ? "Under review"
                                : "Open"
                            }
                          />{" "}
                          · {dateTime(report.created_at)}
                        </summary>
                        <p>{report.details}</p>
                        <form action={resolveSafety} className="compact-form">
                          <input
                            type="hidden"
                            name="report_id"
                            value={report.id}
                          />
                          <label>
                            Review state
                            <select name="status">
                              <option value="reviewing">Reviewing</option>
                              <option value="resolved">Resolved</option>
                            </select>
                          </label>
                          <label>
                            Operations note
                            <textarea name="note" required maxLength={2000} />
                          </label>
                          <SubmitButton pendingLabel="Saving…">
                            Save review
                          </SubmitButton>
                        </form>
                      </details>
                    ))
                  ) : (
                    <EmptyState title="No open safety reports">
                      New concerns will appear here for your team to review.
                    </EmptyState>
                  )}
                </section>
                <section className="dashboard-card" id="backup">
                  <h2>Backup driver readiness</h2>
                  {!isIsolatedDemoEnvironment() && <p>Legacy backup activation is unavailable for real pilot rides. Use the versioned reassignment review in Needs Attention before the driver heads to pickup. Active passenger trips cannot be reassigned.</p>}
                  <p>
                    Confirmation window: {settings.scheduled_confirmation_hours}{" "}
                    hours before pickup. Operations checks readiness and
                    activates backups manually.
                  </p>
                  {!backups.data?.length && (
                    <p className="muted">
                      No backup drivers reserved. Add coverage for a scheduled
                      ride below.
                    </p>
                  )}
                  {(backups.data ?? []).map((backup) => (
                    <article key={backup.id}>
                      <p className="wrap-anywhere">
                        Booking {backup.ride_request_id.slice(0, 8)}
                        <br />
                        Driver {backup.driver_id.slice(0, 8)}
                      </p>
                      <ConfirmForm
                        action={activateBackup}
                        message="Activate this backup and replace the primary driver?"
                      >
                        <input
                          type="hidden"
                          name="ride_id"
                          value={backup.ride_request_id}
                        />
                        <SubmitButton pendingLabel="Activating…" disabled={!isIsolatedDemoEnvironment()}>
                          Activate backup
                        </SubmitButton>
                      </ConfirmForm>
                    </article>
                  ))}
                  <details>
                    <summary>Reserve eligible backup</summary>
                    <form action={setBackup} className="compact-form">
                      <label>
                        Booking reference (full ID)
                        <input name="ride_id" required />
                      </label>
                      <label>
                        Driver reference (full ID)
                        <input name="driver_id" required />
                      </label>
                      <label>
                        Vehicle reference (full ID)
                        <input name="vehicle_id" required />
                      </label>
                      <SubmitButton pendingLabel="Reserving…" disabled={!isIsolatedDemoEnvironment()}>
                        Reserve backup
                      </SubmitButton>
                    </form>
                  </details>
                </section>
              </>
            ),
          },
          {
            id: "business",
            label: "Business",
            content: (
              <>
                <section
                  className="dashboard-card dashboard-wide"
                  id="subscriptions"
                >
                  <h2>Business subscriptions</h2>
                  {subscriptions.data?.length ? (
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Business</th>
                            <th>Plan</th>
                            <th>Status</th>
                            <th>Expiration</th>
                            <th>Billing</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(subscriptions.data ?? []).map((sub) => (
                            <tr key={sub.id}>
                              <td data-label="Business">
                                {orgs.data?.find(
                                  (org) => org.id === sub.organization_id,
                                )?.name ??
                                  `Business ${sub.organization_id.slice(0, 8)}`}
                              </td>
                              <td data-label="Plan">
                                {plans.data?.find(
                                  (plan) => plan.id === sub.plan_id,
                                )?.display_name ?? sub.plan_id}
                              </td>
                              <td data-label="Status">
                                <StatusPill status={sub.status} />
                              </td>
                              <td data-label="Expiration">
                                {dateTime(sub.expires_at)}
                              </td>
                              <td data-label="Billing">
                                <StatusPill status={sub.billing_status} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <EmptyState title="No business subscriptions">
                      Choose a business and plan below to record a subscription.
                    </EmptyState>
                  )}
                  <details>
                    <summary>Activate, extend, cancel or change plan</summary>
                    <AdminSubscriptionForm organizations={orgs.data ?? []} plans={plans.data ?? []} subscriptions={subscriptions.data ?? []}/>
                  </details>
                </section>
              </>
            ),
          },
          {
            id: "system",
            label: "System",
            content: (
              <>
                <section className="dashboard-card">
                  <h2>Release controls</h2>
                  <p>Pause and area closure reject new requests. Confirmed and active rides remain available. Integrations off blocks optional simulated provider actions; it does not stop authentication, trip state or manual cash records.</p>
                  <form action={setReleaseControls} className="compact-form">
                    <label className="check-label"><input type="checkbox" name="bookings_paused" defaultChecked={settings.bookings_paused}/> Pause new bookings</label>
                    <label className="check-label"><input type="checkbox" name="service_area_open" defaultChecked={settings.service_area_open}/> Entire configured pilot service area open</label>
                    <label className="check-label"><input type="checkbox" name="integrations_enabled" defaultChecked={settings.integrations_enabled}/> Optional integrations enabled</label>
                    <label>Reason<textarea name="reason" minLength={5} maxLength={2000} required/></label>
                    <SubmitButton pendingLabel="Saving controls…">Save release controls</SubmitButton>
                  </form>
                </section>
                <section className="dashboard-card"><h2>Capabilities</h2>{releaseCapabilities(settings.integrations_enabled, settings.demo_mode && settings.mock_payment_enabled).map(capability => <p key={capability.name}><strong>{capability.name} · {capability.mode}</strong><br/>{capability.detail}</p>)}</section>
                <section className="dashboard-card" id="configuration">
                  <h2>Application configuration</h2>
                  <form action={updateConfiguration} className="compact-form">
                    <label>
                      Driver platform commission (%)
                      <input
                        type="number"
                        name="driver_commission_percent"
                        min={0}
                        max={0}
                        step="0.01"
                        defaultValue={settings.driver_commission_percent}
                        required
                      />
                    </label>
                    <label>
                      Matching radius (km)
                      <input
                        type="number"
                        name="default_matching_radius_km"
                        min={1}
                        max={200}
                        defaultValue={settings.default_matching_radius_km}
                        required
                      />
                    </label>
                    <label>
                      Offer timeout (seconds)
                      <input
                        type="number"
                        name="offer_timeout_seconds"
                        min={30}
                        max={600}
                        defaultValue={settings.offer_timeout_seconds}
                        required
                      />
                    </label>
                    <label>
                      Confirmation window (hours)
                      <input
                        type="number"
                        name="scheduled_confirmation_hours"
                        min={1}
                        max={24}
                        defaultValue={settings.scheduled_confirmation_hours}
                        required
                      />
                    </label>
                    <label>
                      Local estimated speed (km/h)
                      <input
                        type="number"
                        name="mock_route_speed_kph"
                        min={5}
                        max={120}
                        defaultValue={settings.mock_route_speed_kph}
                        required
                      />
                    </label>
                    <details>
                      <summary>Matching weights</summary>
                      {[
                        "distance",
                        "reliability",
                        "going_home",
                        "return_trip",
                        "idle",
                        "preferences",
                      ].map((key) => (
                        <label key={key}>
                          {key.replaceAll("_", " ")}
                          <input
                            name={`weight_${key}`}
                            type="number"
                            min={0}
                            max={1000}
                            required
                            defaultValue={settings.matching_weights[key]}
                          />
                        </label>
                      ))}
                    </details>
                    <label className="check-label">
                      <input
                        type="checkbox"
                        name="backup_driver_enabled"
                        defaultChecked={settings.backup_driver_enabled}
                      />{" "}
                      Enable backup reservations
                    </label>
                    <SubmitButton pendingLabel="Saving…">
                      Save configuration
                    </SubmitButton>
                  </form>
                </section>
                <section className="dashboard-card">
                  <h2>Demo payment testing</h2>
                  {isIsolatedDemoEnvironment() &&
                  settings.integrations_enabled &&
                  settings.demo_mode &&
                  settings.mock_payment_enabled ? (
                    <>
                      <p className="notice">
                        DEMO PAYMENT · No money is collected or refunded.
                      </p>
                      <form action={simulatePayment} className="compact-form">
                        <input
                          type="hidden"
                          name="event_id"
                          value={randomUUID()}
                        />
                        <label>
                          Booking reference (full ID)
                          <input name="ride_id" required />
                        </label>
                        <label>
                          Simulated status
                          <select name="status">
                            {["pending", "paid", "failed", "refunded"].map(
                              (status) => (
                                <option key={status}>{status}</option>
                              ),
                            )}
                          </select>
                        </label>
                        <SubmitButton pendingLabel="Simulating…">
                          Record demo payment
                        </SubmitButton>
                      </form>
                    </>
                  ) : (
                    <p>
                      Demo payments are disabled. Cash remains available. Enable
                      only in an explicitly configured demo environment.
                    </p>
                  )}
                </section>
                <section className="dashboard-wide" id="audit">
                  <h2>Recent audit events</h2>
                  {audits.data?.length ? (
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Action</th>
                            <th>Entity</th>
                            <th>Time</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(audits.data ?? []).map((event) => (
                            <tr key={event.id}>
                              <td data-label="Action">
                                {event.action.replaceAll("_", " ")}
                              </td>
                              <td data-label="Entity">
                                {event.entity_type.replaceAll("_", " ")}
                              </td>
                              <td data-label="Time">
                                {dateTime(event.created_at)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <EmptyState title="No recent audit events">
                      Operations changes will be recorded here.
                    </EmptyState>
                  )}
                </section>
              </>
            ),
          },
        ]}
      />
    </Dashboard>
  );
}
