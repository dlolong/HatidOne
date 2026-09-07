"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { EmptyState, StatusPill } from "@/components/ui";

interface OperationsRide {
  id: string;
  pickup_address: string;
  dropoff_address: string;
  scheduled_at: string | null;
  status: string;
}
const unassigned = ["requested", "searching", "offered"];
const active = ["driver_en_route", "driver_arrived", "trip_started"];
const pageSize = 8;
function dateTime(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("en-PH", {
        timeZone: "Asia/Manila",
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "Not scheduled";
}

export function OperationsRideList({ rides }: { rides: OperationsRide[] }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(0);
  const prefix = useId();
  const matching = rides.filter((ride) => {
    const query = search.trim().toLowerCase();
    return (
      (!query ||
        `${ride.id} ${ride.pickup_address} ${ride.dropoff_address}`
          .toLowerCase()
          .includes(query)) &&
      (status === "all" ||
        (status === "unassigned" && unassigned.includes(ride.status)) ||
        (status === "active" && active.includes(ride.status)) ||
        ride.status === status)
    );
  });
  const lastPage = Math.max(0, Math.ceil(matching.length / pageSize) - 1);
  const currentPage = Math.min(page, lastPage);
  const visible = matching.slice(
    currentPage * pageSize,
    (currentPage + 1) * pageSize,
  );
  return (
    <section className="dashboard-card dashboard-wide">
      <h2>Upcoming and active bookings</h2>
      <div className="form-grid">
        <label htmlFor={`${prefix}-search`}>
          Search route or booking reference
          <input
            id={`${prefix}-search`}
            type="search"
            value={search}
            placeholder="Pickup, destination or reference"
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(0);
            }}
          />
        </label>
        <label htmlFor={`${prefix}-status`}>
          Show bookings
          <select
            id={`${prefix}-status`}
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(0);
            }}
          >
            <option value="all">All open bookings</option>
            <option value="unassigned">Unassigned</option>
            <option value="active">Active trips</option>
            <option value="assigned">Driver assigned</option>
            <option value="no_show">Pickup missed</option>
          </select>
        </label>
      </div>
      {visible.length ? (
        <>
          <p className="muted" role="status">
            {currentPage * pageSize + 1}–
            {Math.min((currentPage + 1) * pageSize, matching.length)} of{" "}
            {matching.length} bookings
            {rides.length === 100
              ? " · Showing the first 100 open bookings"
              : ""}
          </p>
          <div className="table-scroll">
            <table>
              <caption>Open bookings and driver coverage</caption>
              <thead>
                <tr>
                  <th scope="col">Route</th>
                  <th scope="col">Pickup time</th>
                  <th scope="col">Status</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((ride) => (
                  <tr key={ride.id}>
                    <td data-label="Route">
                      <strong>{ride.pickup_address}</strong>
                      <br />
                      <span>to {ride.dropoff_address}</span>
                      <br />
                      <small className="muted">
                        Ref. {ride.id.slice(0, 8)}
                      </small>
                    </td>
                    <td data-label="Pickup time">
                      {dateTime(ride.scheduled_at)}
                    </td>
                    <td data-label="Status">
                      <StatusPill status={ride.status} />
                    </td>
                    <td data-label="Action">
                      {unassigned.includes(ride.status) ? (
                        <Link
                          className="button button-secondary"
                          href={`/admin/dispatch?ride=${ride.id}`}
                        >
                          Find drivers
                        </Link>
                      ) : (
                        <details>
                          <summary>Booking reference</summary>
                          <p className="wrap-anywhere">{ride.id}</p>
                        </details>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {lastPage > 0 && (
            <nav className="button-row" aria-label="Booking pages">
              <button
                type="button"
                className="button button-secondary"
                disabled={currentPage === 0}
                onClick={() => setPage(currentPage - 1)}
              >
                Previous
              </button>
              <span>
                Page {currentPage + 1} of {lastPage + 1}
              </span>
              <button
                type="button"
                className="button button-secondary"
                disabled={currentPage === lastPage}
                onClick={() => setPage(currentPage + 1)}
              >
                Next
              </button>
            </nav>
          )}
        </>
      ) : (
        <EmptyState
          title={rides.length ? "No bookings match" : "No open bookings"}
          action={
            rides.length ? (
              <button
                type="button"
                className="button button-secondary"
                onClick={() => {
                  setSearch("");
                  setStatus("all");
                  setPage(0);
                }}
              >
                Clear filters
              </button>
            ) : undefined
          }
        >
          {rides.length
            ? "Try another place or clear your filters."
            : "Upcoming requests and active trips will appear here."}
        </EmptyState>
      )}
    </section>
  );
}
