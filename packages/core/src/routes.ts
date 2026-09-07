export type Coordinates = { latitude: number; longitude: number };
export type ServiceLocation = { id: string; label: string; coordinates?: Coordinates };
export type RoutePreference = 'fastest' | 'avoid_tolls' | 'preferred_route';
export type RouteEstimate = {
  distanceMeters: number | null;
  durationSeconds: number | null;
  estimatedToll: number | null;
  source: 'local_estimate';
  preference: RoutePreference;
  disclaimer: string;
};
export type RouteInput = { pickup: ServiceLocation; destination: ServiceLocation; preference: RoutePreference };
export interface RouteProvider {
  searchLocations(query: string): Promise<ServiceLocation[]>;
  resolveLocation(idOrAddress: string): Promise<ServiceLocation>;
  estimateRoute(input: RouteInput): Promise<RouteEstimate>;
  estimateDistance(from: Coordinates, to: Coordinates): number;
  estimateDuration(distanceMeters: number): number;
  estimateToll(pickup: ServiceLocation, destination: ServiceLocation, preference: RoutePreference): number | null;
}
// Approximate reference points, not pickup instructions or navigable road routes.
export const DEMO_LOCATIONS: readonly ServiceLocation[] = [
  { id: 'naia', label: 'NAIA Terminal 3 reference point', coordinates: { latitude: 14.5181, longitude: 121.0192 } },
  { id: 'makati', label: 'Makati service area', coordinates: { latitude: 14.5547, longitude: 121.0244 } },
  { id: 'tagaytay', label: 'Tagaytay service area', coordinates: { latitude: 14.1153, longitude: 120.9621 } },
  { id: 'batangas', label: 'Batangas City service area', coordinates: { latitude: 13.7565, longitude: 121.0583 } },
  { id: 'clark', label: 'Clark airport reference point', coordinates: { latitude: 15.186, longitude: 120.56 } },
];
export function validCoordinates(point: Coordinates): boolean {
  return Number.isFinite(point.latitude) && Number.isFinite(point.longitude)
    && Math.abs(point.latitude) <= 90 && Math.abs(point.longitude) <= 180;
}
export function haversineMeters(from: Coordinates, to: Coordinates): number {
  if (!validCoordinates(from) || !validCoordinates(to)) throw new Error('Valid coordinates are required.');
  const radians = (value: number) => value * Math.PI / 180;
  const a = Math.sin(radians(to.latitude - from.latitude) / 2) ** 2
    + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude))
    * Math.sin(radians(to.longitude - from.longitude) / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(Math.min(1, a)), Math.sqrt(Math.max(0, 1 - a)));
}
export class LocalRouteProvider implements RouteProvider {
  private readonly speedKph: number;
  private readonly tolls: Record<string, number>;
  constructor(options: { speedKph?: number; tollEstimates?: Record<string, number> } = {}) {
    this.speedKph = options.speedKph ?? 30;
    if (!Number.isFinite(this.speedKph) || this.speedKph <= 0 || this.speedKph > 150) throw new Error('Invalid route speed.');
    this.tolls = { ...options.tollEstimates };
    if (Object.values(this.tolls).some(value => !Number.isFinite(value) || value < 0)) throw new Error('Invalid toll configuration.');
  }
  async searchLocations(query: string): Promise<ServiceLocation[]> {
    const normalized = query.trim().toLowerCase();
    return DEMO_LOCATIONS.filter(location => location.label.toLowerCase().includes(normalized));
  }
  async resolveLocation(idOrAddress: string): Promise<ServiceLocation> {
    const address = idOrAddress.trim();
    if (!address || address.length > 240) throw new Error('Enter an address of 1–240 characters.');
    return DEMO_LOCATIONS.find(location => location.id === address || location.label.toLowerCase() === address.toLowerCase())
      ?? { id: `manual:${address}`, label: address };
  }
  estimateDistance(from: Coordinates, to: Coordinates): number { return Math.round(haversineMeters(from, to)); }
  estimateDuration(distanceMeters: number): number {
    if (!Number.isFinite(distanceMeters) || distanceMeters < 0) throw new Error('Invalid distance.');
    return Math.ceil(distanceMeters / (this.speedKph * 1000 / 3600));
  }
  estimateToll(pickup: ServiceLocation, destination: ServiceLocation, preference: RoutePreference): number | null {
    // An avoid-tolls preference is not evidence that a road route is toll-free.
    return this.tolls[`${pickup.id}:${destination.id}:${preference}`] ?? null;
  }
  async estimateRoute(input: RouteInput): Promise<RouteEstimate> {
    const distanceMeters = input.pickup.coordinates && input.destination.coordinates
      ? this.estimateDistance(input.pickup.coordinates, input.destination.coordinates) : null;
    return {
      distanceMeters,
      durationSeconds: distanceMeters === null ? null : this.estimateDuration(distanceMeters),
      estimatedToll: this.estimateToll(input.pickup, input.destination, input.preference),
      source: 'local_estimate', preference: input.preference,
      disclaimer: 'Local straight-line estimate. Road distance, traffic and tolls are unverified. Confirm pickup and route with your driver.',
    };
  }
}
export const SERVICE_CORRIDORS = [
  { slug: 'airport-to-makati', title: 'Airport to Makati transfer', pickup: 'naia', destination: 'makati', service: 'Airport transfer', description: 'Plan an airport pickup with a clear schedule, passenger count and vehicle request.' },
  { slug: 'manila-to-tagaytay', title: 'Manila to Tagaytay transfer', pickup: 'makati', destination: 'tagaytay', service: 'Resort transfer', description: 'Arrange a scheduled ride to the Tagaytay service area and coordinate your exact resort pickup.' },
  { slug: 'manila-to-batangas', title: 'Manila to Batangas transfer', pickup: 'makati', destination: 'batangas', service: 'Regional transfer', description: 'Keep a planned regional journey in one booking with transparent local estimates.' },
] as const;
