export const BOOKING_VEHICLE_TYPES = ['sedan', 'suv', 'van', 'motorcycle'] as const;
export type BookingVehicleType = (typeof BOOKING_VEHICLE_TYPES)[number];

export const CANCELLABLE_STATUSES = ['draft', 'requested', 'searching', 'offered', 'assigned', 'driver_en_route', 'driver_arrived'] as const;

export function isBookingVehicleType(value: unknown): value is BookingVehicleType {
  return typeof value === 'string' && BOOKING_VEHICLE_TYPES.some((type) => type === value);
}

export function parseCoordinate(value: unknown, minimum: number, maximum: number): number | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const coordinate = Number(value);
  return Number.isFinite(coordinate) && coordinate >= minimum && coordinate <= maximum
    ? coordinate
    : null;
}

export function parsePhilippineSchedule(value: unknown): Date | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}:00+08:00`);
  return Number.isNaN(parsed.valueOf()) ? null : parsed;
}

export function canPassengerCancel(status: string): boolean {
  return CANCELLABLE_STATUSES.some((candidate) => candidate === status);
}

export function bookingStatusPresentation(status: string): { label: string; detail: string; tone: 'neutral' | 'active' | 'success' | 'danger' } {
  const presentations: Record<string, { label: string; detail: string; tone: 'neutral' | 'active' | 'success' | 'danger' }> = {
    draft: { label: 'Draft', detail: 'This booking has not been requested yet.', tone: 'neutral' },
    requested: { label: 'Requested', detail: 'Your scheduled ride request was received.', tone: 'active' },
    searching: { label: 'Searching', detail: 'HatidOne is looking for an eligible driver.', tone: 'active' },
    offered: { label: 'Driver offered', detail: 'An eligible driver is reviewing your request.', tone: 'active' },
    assigned: { label: 'Driver assigned', detail: 'A driver has been assigned to your ride.', tone: 'success' },
    driver_en_route: { label: 'Driver en route', detail: 'Your driver is heading to the pickup.', tone: 'success' },
    driver_arrived: { label: 'Driver arrived', detail: 'Your driver has reached the pickup.', tone: 'success' },
    trip_started: { label: 'Trip started', detail: 'Your trip is currently underway.', tone: 'success' },
    trip_completed: { label: 'Completed', detail: 'Your trip has been completed.', tone: 'success' },
    passenger_cancelled: { label: 'Cancelled', detail: 'You cancelled this booking.', tone: 'danger' },
    driver_cancelled: { label: 'Driver cancelled', detail: 'The assigned driver cancelled this ride.', tone: 'danger' },
    operator_cancelled: { label: 'Operator cancelled', detail: 'Operations cancelled this ride.', tone: 'danger' },
    expired: { label: 'Expired', detail: 'This ride request expired.', tone: 'danger' },
    no_driver_found: { label: 'No driver found', detail: 'No eligible driver was available.', tone: 'danger' },
    no_show: { label: 'No show', detail: 'This trip was marked as a no-show.', tone: 'danger' },
  };
  return presentations[status] ?? { label: 'Status unavailable', detail: 'Refresh for the latest booking status.', tone: 'neutral' };
}

export function formatPeso(value: number | string | null): string {
  const amount = typeof value === 'string' ? Number(value) : value;
  if (amount === null || !Number.isFinite(amount)) return 'Pending';
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);
}
