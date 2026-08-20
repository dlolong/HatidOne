import { describe, expect, it } from 'vitest';
import {
  bookingStatusPresentation,
  canPassengerCancel,
  isBookingVehicleType,
  parseCoordinate,
  parsePhilippineSchedule,
} from './booking';

describe('passenger booking helpers', () => {
  it('validates only supported vehicle types and finite coordinate ranges', () => {
    expect(isBookingVehicleType('sedan')).toBe(true);
    expect(isBookingVehicleType('limousine')).toBe(false);
    expect(parseCoordinate('14.5995', -90, 90)).toBe(14.5995);
    expect(parseCoordinate('181', -180, 180)).toBeNull();
    expect(parseCoordinate('', -90, 90)).toBeNull();
  });

  it('interprets schedule input as Philippine time', () => {
    expect(parsePhilippineSchedule('2027-01-15T08:30')?.toISOString()).toBe('2027-01-15T00:30:00.000Z');
    expect(parsePhilippineSchedule('not-a-date')).toBeNull();
  });

  it('keeps cancellation aligned with the shared ride state machine', () => {
    expect(canPassengerCancel('requested')).toBe(true);
    expect(canPassengerCancel('driver_arrived')).toBe(true);
    expect(canPassengerCancel('trip_started')).toBe(false);
    expect(canPassengerCancel('passenger_cancelled')).toBe(false);
  });

  it('presents active, assigned, and cancellation states clearly', () => {
    expect(bookingStatusPresentation('searching').tone).toBe('active');
    expect(bookingStatusPresentation('assigned').label).toBe('Driver assigned');
    expect(bookingStatusPresentation('passenger_cancelled').label).toBe('Cancelled');
  });
});
