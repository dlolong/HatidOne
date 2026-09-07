import { haversineMeters, validCoordinates, type Coordinates } from './routes';
export type MatchingJob = { id: string; pickup: Coordinates; destination: Coordinates; scheduledAt: string; durationSeconds: number; vehicleType: string; serviceType: string; passengerCount: number };
export type ReliabilitySummary = { completed: number; cancelled: number; noShows: number; onTime: number };
export type MatchingDriver = {
  location: Coordinates; available: boolean; vehicleType: string; capacity: number; preferredServices: string[];
  preferredAreas?: Coordinates[]; goingHome?: { destination: Coordinates; after: string }; outbound?: MatchingJob;
  commitments?: MatchingJob[]; reliability?: ReliabilitySummary; idleMinutes?: number;
};
export type MatchingConfig = {
  radiusKm: number; bufferMinutes: number; minimumReliabilitySamples: number;
  weights: { distance: number; service: number; area: number; reliability: number; goingHome: number; returnTrip: number; idle: number };
};
export const DEFAULT_MATCHING_CONFIG: MatchingConfig = {
  radiusKm: 25, bufferMinutes: 30, minimumReliabilitySamples: 10,
  weights: { distance: 30, service: 10, area: 10, reliability: 10, goingHome: 20, returnTrip: 15, idle: 5 },
};
export type ScoredJob = MatchingJob & { score: number; reasons: string[]; goingHome: boolean; returnMatch: boolean };
export function reliabilityMetrics(events: ReliabilitySummary, minimumSamples = 10) {
  for (const count of Object.values(events)) if (!Number.isInteger(count) || count < 0) throw new Error('Invalid reliability sample.');
  const sampleSize = events.completed + events.cancelled + events.noShows;
  return { sampleSize, established: sampleSize >= minimumSamples,
    completionRate: sampleSize ? events.completed / sampleSize : null,
    cancellationRate: sampleSize ? events.cancelled / sampleSize : null,
    onTimeRate: events.completed ? Math.min(events.onTime / events.completed, 1) : null,
    noShows: events.noShows };
}
function start(job: MatchingJob): number { return Date.parse(job.scheduledAt); }
function end(job: MatchingJob): number { return start(job) + job.durationSeconds * 1000; }
function validJob(job: MatchingJob): boolean {
  return Number.isFinite(start(job)) && Number.isFinite(job.durationSeconds) && job.durationSeconds > 0
    && Number.isInteger(job.passengerCount) && job.passengerCount > 0 && validCoordinates(job.pickup) && validCoordinates(job.destination);
}
export function scheduleConflicts(job: MatchingJob, commitments: MatchingJob[], bufferMinutes = 30): boolean {
  if (!validJob(job) || !Number.isFinite(bufferMinutes) || bufferMinutes < 0) return true;
  return commitments.some(other => !validJob(other) || (job.id !== other.id
    && start(job) < end(other) + bufferMinutes * 60_000 && end(job) + bufferMinutes * 60_000 > start(other)));
}
export function rankJobs(jobs: MatchingJob[], driver: MatchingDriver, config: MatchingConfig = DEFAULT_MATCHING_CONFIG): ScoredJob[] {
  if (!driver.available || !validCoordinates(driver.location) || !Number.isInteger(driver.capacity) || driver.capacity < 1) return [];
  if (!Number.isFinite(config.radiusKm) || config.radiusKm <= 0 || !Number.isFinite(config.bufferMinutes) || config.bufferMinutes < 0
    || !Number.isInteger(config.minimumReliabilitySamples) || config.minimumReliabilitySamples < 1
    || Object.values(config.weights).some(weight => !Number.isFinite(weight) || weight < 0)) throw new Error('Invalid matching configuration.');
  const commitments = [...(driver.commitments ?? []), ...(driver.outbound ? [driver.outbound] : [])];
  const metrics = driver.reliability ? reliabilityMetrics(driver.reliability, config.minimumReliabilitySamples) : null;
  return jobs.flatMap((job): ScoredJob[] => {
    if (!validJob(job) || job.vehicleType !== driver.vehicleType || job.passengerCount > driver.capacity
      || job.id === driver.outbound?.id || scheduleConflicts(job, commitments, config.bufferMinutes)) return [];
    const outbound = driver.outbound;
    const returnMatch = !!outbound && validJob(outbound) && start(job) >= end(outbound) + config.bufferMinutes * 60_000
      && haversineMeters(job.pickup, outbound.destination) <= config.radiusKm * 1000
      && haversineMeters(job.destination, outbound.pickup) < haversineMeters(job.pickup, outbound.pickup);
    const pickupDistance = haversineMeters(returnMatch && outbound ? outbound.destination : driver.location, job.pickup);
    if (pickupDistance > config.radiusKm * 1000) return [];
    const home = driver.goingHome;
    const goingHome = !!home && validCoordinates(home.destination) && start(job) >= Date.parse(home.after)
      && haversineMeters(job.destination, home.destination) < haversineMeters(job.pickup, home.destination);
    const preferredService = driver.preferredServices.includes(job.serviceType);
    const preferredArea = driver.preferredAreas?.some(area => validCoordinates(area) && haversineMeters(area, job.pickup) <= config.radiusKm * 1000) ?? false;
    const reasons = [`${(pickupDistance / 1000).toFixed(1)} km approximate pickup distance`];
    if (preferredService) reasons.push('Preferred service');
    if (preferredArea) reasons.push('Preferred operating area');
    if (goingHome) reasons.push('Trips going your way');
    if (returnMatch) reasons.push('Return ride after your outbound trip');
    if (!metrics?.established) reasons.push('Reliability sample still building');
    const idle = Number.isFinite(driver.idleMinutes) ? Math.max(0, Math.min(driver.idleMinutes ?? 0, 120)) / 120 : 0;
    const w = config.weights;
    const score = (1 - pickupDistance / (config.radiusKm * 1000)) * w.distance
      + Number(preferredService) * w.service + Number(preferredArea) * w.area
      + (metrics?.established ? metrics.completionRate ?? 0.5 : 0.5) * w.reliability
      + Number(goingHome) * w.goingHome + Number(returnMatch) * w.returnTrip + idle * w.idle;
    return [{ ...job, score: Math.round(score * 100) / 100, reasons, goingHome, returnMatch }];
  }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

/** Map database-owned snake-case settings into the platform-neutral scorer. */
export function matchingConfigFromSettings(settings: { default_matching_radius_km?: number; matching_weights?: Record<string, number> } | null): MatchingConfig {
  const defaults = DEFAULT_MATCHING_CONFIG;
  const w = settings?.matching_weights ?? {};
  const safe = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
  const preference = safe(w.preferences, defaults.weights.service + defaults.weights.area);
  return { ...defaults, radiusKm: Math.max(1, safe(settings?.default_matching_radius_km, defaults.radiusKm)), weights: {
    distance: safe(w.distance, defaults.weights.distance), reliability: safe(w.reliability, defaults.weights.reliability),
    service: preference / 2, area: preference / 2, goingHome: safe(w.going_home, defaults.weights.goingHome),
    returnTrip: safe(w.return_trip, defaults.weights.returnTrip), idle: safe(w.idle, defaults.weights.idle),
  } };
}
