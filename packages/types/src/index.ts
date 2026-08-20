export const RIDE_REQUEST_STATUSES = [
  'draft',
  'requested',
  'searching',
  'offered',
  'assigned',
  'driver_en_route',
  'driver_arrived',
  'trip_started',
  'trip_completed',
  'passenger_cancelled',
  'driver_cancelled',
  'operator_cancelled',
  'expired',
  'no_driver_found',
  'no_show'
] as const;

export type RideRequestStatus = (typeof RIDE_REQUEST_STATUSES)[number];

export const ACTIVE_RIDE_TRANSITIONS: Record<RideRequestStatus, readonly RideRequestStatus[]> = {
  draft: ['requested', 'passenger_cancelled'],
  requested: ['searching', 'passenger_cancelled', 'expired'],
  searching: ['offered', 'no_driver_found', 'passenger_cancelled', 'expired'],
  offered: ['assigned', 'searching', 'passenger_cancelled', 'expired'],
  assigned: ['driver_en_route', 'driver_cancelled', 'passenger_cancelled', 'operator_cancelled'],
  driver_en_route: ['driver_arrived', 'driver_cancelled', 'passenger_cancelled', 'operator_cancelled'],
  driver_arrived: ['trip_started', 'no_show', 'driver_cancelled', 'passenger_cancelled'],
  trip_started: ['trip_completed', 'operator_cancelled'],
  trip_completed: [],
  passenger_cancelled: [],
  driver_cancelled: [],
  operator_cancelled: [],
  expired: [],
  no_driver_found: [],
  no_show: []
};

export function canTransitionRide(from: RideRequestStatus, to: RideRequestStatus): boolean {
  return ACTIVE_RIDE_TRANSITIONS[from].includes(to);
}
