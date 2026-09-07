import {
  rankJobs,
  DEMO_LOCATIONS,
  type MatchingJob,
  type MatchingDriver,
  type Coordinates,
} from "@hatidone/core";
import type { DriverData, Ride } from "./data";
import { ACTIVE_STATUSES } from "./data";
export function matchingJob(ride: Ride): MatchingJob | null {
  if (!ride.scheduled_at || ride.estimated_duration_seconds === null)
    return null;
  const values = [
    ride.pickup_latitude,
    ride.pickup_longitude,
    ride.dropoff_latitude,
    ride.dropoff_longitude,
  ];
  if (
    !values.every(
      (value) => typeof value === "number" && Number.isFinite(value),
    )
  )
    return null;
  return {
    id: ride.id,
    pickup: {
      latitude: ride.pickup_latitude,
      longitude: ride.pickup_longitude,
    },
    destination: {
      latitude: ride.dropoff_latitude,
      longitude: ride.dropoff_longitude,
    },
    scheduledAt: ride.scheduled_at,
    durationSeconds: ride.estimated_duration_seconds,
    vehicleType: ride.vehicle_type,
    serviceType: ride.service_type,
    passengerCount: ride.passenger_count,
  };
}
export function suggestedJobs(data: DriverData, location: Coordinates | null) {
  if (!location || !data.vehicle) return [];
  const prefs = data.preferences;
  const commitments = data.assignments
    .filter((assignment) => ACTIVE_STATUSES.includes(assignment.ride.status))
    .flatMap((assignment) => {
      const job = matchingJob(assignment.ride);
      return job ? [job] : [];
    });
  const outbound = [...commitments]
    .sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt))
    .find(
      (job) =>
        Date.parse(job.scheduledAt) + job.durationSeconds * 1000 > Date.now(),
    );
  const driver: MatchingDriver = {
    location,
    available: Boolean(data.driver?.online),
    vehicleType: data.vehicle.vehicle_type,
    capacity: data.vehicle.capacity,
    preferredServices: prefs.service_types,
    preferredAreas: DEMO_LOCATIONS.filter((place) =>
      prefs.preferred_areas.some((area) =>
        place.label.toLowerCase().includes(area.toLowerCase()),
      ),
    ).flatMap((place) => (place.coordinates ? [place.coordinates] : [])),
    commitments,
    outbound,
    goingHome:
      prefs.going_home_enabled &&
      prefs.home_latitude !== null &&
      prefs.home_longitude !== null &&
      prefs.going_home_departure
        ? {
            destination: {
              latitude: prefs.home_latitude,
              longitude: prefs.home_longitude,
            },
            after: prefs.going_home_departure,
          }
        : undefined,
  };
  return rankJobs(
    data.offers.flatMap((offer) => {
      const job = matchingJob(offer.ride);
      return job ? [job] : [];
    }),
    driver,
  );
}
