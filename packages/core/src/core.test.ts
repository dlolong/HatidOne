import { describe, expect, it } from 'vitest';
import { LocalRouteProvider, haversineMeters, rankJobs, reliabilityMetrics, scheduleConflicts, MockPaymentProvider, mockPaymentsAllowed, type MatchingJob, type MatchingDriver } from './index';
const origin = { latitude: 14.55, longitude: 121.02 };
const destination = { latitude: 14.11, longitude: 120.96 };
const job: MatchingJob = { id: 'a', pickup: origin, destination, scheduledAt: '2026-09-08T03:00:00Z', durationSeconds: 3600, vehicleType: 'van', serviceType: 'resort', passengerCount: 4 };
const driver: MatchingDriver = { location: origin, available: true, vehicleType: 'van', capacity: 8, preferredServices: ['resort'] };
describe('local routes', () => {
  it('calculates symmetric finite distances and rejects invalid coordinates', () => {
    expect(haversineMeters(origin, origin)).toBe(0);
    expect(haversineMeters(origin, destination)).toBeCloseTo(haversineMeters(destination, origin));
    expect(() => haversineMeters({ latitude: NaN, longitude: 0 }, origin)).toThrow();
    expect(haversineMeters({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 180 })).toBeGreaterThan(20_000_000);
  });
  it('keeps unknown addresses and tolls explicitly unknown', async () => {
    const provider = new LocalRouteProvider();
    const pickup = await provider.resolveLocation('Fictional resort lobby');
    expect(pickup.coordinates).toBeUndefined();
    const route = await provider.estimateRoute({ pickup, destination: await provider.resolveLocation('makati'), preference: 'avoid_tolls' });
    expect(route).toMatchObject({ distanceMeters: null, durationSeconds: null, estimatedToll: null, source: 'local_estimate' });
  });
  it('applies configured speed and only explicitly configured toll estimates', async () => {
    const provider = new LocalRouteProvider({ speedKph: 36, tollEstimates: { 'naia:makati:fastest': 50 } });
    expect(provider.estimateDuration(1000)).toBe(100);
    const route = await provider.estimateRoute({ pickup: await provider.resolveLocation('naia'), destination: await provider.resolveLocation('makati'), preference: 'fastest' });
    expect(route.estimatedToll).toBe(50);
    expect(() => new LocalRouteProvider({ speedKph: 0 })).toThrow();
  });
});
describe('matching safety and explainability', () => {
  it('filters availability, capacity, vehicle, distance and invalid input', () => {
    expect(rankJobs([job], { ...driver, available: false })).toEqual([]);
    expect(rankJobs([job], { ...driver, capacity: 2 })).toEqual([]);
    expect(rankJobs([job], { ...driver, vehicleType: 'sedan' })).toEqual([]);
    expect(rankJobs([{ ...job, pickup: { latitude: 0, longitude: 0 } }], driver)).toEqual([]);
    expect(rankJobs([{ ...job, durationSeconds: -1 }], driver)).toEqual([]);
  });
  it('rejects overlapping commitments and honors the exact buffer boundary', () => {
    expect(scheduleConflicts(job, [{ ...job, id: 'other' }])).toBe(true);
    expect(scheduleConflicts({ ...job, id: 'b', scheduledAt: '2026-09-08T04:29:59Z' }, [job])).toBe(true);
    expect(scheduleConflicts({ ...job, id: 'b', scheduledAt: '2026-09-08T04:30:00Z' }, [job])).toBe(false);
  });
  it('prioritizes Going Home and returns explainable reasons', () => {
    const [match] = rankJobs([job], { ...driver, goingHome: { destination, after: '2026-09-08T02:30:00Z' } });
    expect(match.goingHome).toBe(true);
    expect(match.reasons).toContain('Trips going your way');
  });
  it('suggests a buffered return from the outbound destination even away from current GPS', () => {
    const returning = { ...job, id: 'return', pickup: destination, destination: origin, scheduledAt: '2026-09-08T04:30:00Z' };
    expect(rankJobs([returning], { ...driver, outbound: job })[0]?.returnMatch).toBe(true);
    expect(rankJobs([{ ...returning, scheduledAt: '2026-09-08T03:30:00Z' }], { ...driver, outbound: job })).toEqual([]);
  });
  it('does not penalize a tiny reliability sample and breaks ties deterministically', () => {
    expect(reliabilityMetrics({ completed: 0, cancelled: 1, noShows: 0, onTime: 0 }).established).toBe(false);
    const fresh = rankJobs([job], driver)[0].score;
    expect(rankJobs([job], { ...driver, reliability: { completed: 0, cancelled: 1, noShows: 0, onTime: 0 } })[0].score).toBe(fresh);
    expect(rankJobs([{ ...job, id: 'b' }, job], driver).map(row => row.id)).toEqual(['a', 'b']);
  });
});
describe('mock payment boundary', () => {
  it('fails closed in ordinary production and when the feature is disabled', () => {
    expect(() => new MockPaymentProvider({ environment: 'production', demoMode: false, mockPaymentEnabled: true })).toThrow();
    expect(mockPaymentsAllowed({ environment: 'development', demoMode: true, mockPaymentEnabled: false })).toBe(false);
  });
  it('marks every simulated result as demo', async () => {
    const provider = new MockPaymentProvider({ environment: 'test', demoMode: false, mockPaymentEnabled: true });
    expect(await provider.simulate({ eventId: '11111111-1111-4111-8111-111111111111', bookingId: '22222222-2222-4222-8222-222222222222', status: 'paid' })).toMatchObject({ label: 'DEMO PAYMENT', source: 'mock', status: 'paid' });
  });
});

import { matchingConfigFromSettings } from './index';
describe('database matching configuration adapter',()=>{
  it('uses configured weights and radius instead of client defaults',()=>{
    const config=matchingConfigFromSettings({default_matching_radius_km:75,matching_weights:{distance:2,preferences:20,going_home:80,reliability:5,return_trip:40,idle:3}});
    expect(config.radiusKm).toBe(75);expect(config.weights).toEqual({distance:2,service:10,area:10,goingHome:80,reliability:5,returnTrip:40,idle:3});
  });
});
