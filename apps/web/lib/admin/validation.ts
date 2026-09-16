export const REVIEW_STATES = ['under_review', 'verified', 'rejected', 'suspended'] as const;
export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
export function driverQueueFilters(params: { status?: string; q?: string; page?: string }) {
  const status = params.status === 'all' ? 'all' : REVIEW_STATES.find(state => state === params.status) ?? 'under_review';
  // Restrict PostgREST filter syntax; search is a literal name/email fragment.
  const query = (params.q ?? '').replace(/[^\p{L}\p{N}@+_ .'-]/gu, '').trim().slice(0, 80);
  const parsed = Number(params.page);
  const page = Number.isInteger(parsed) && parsed > 0 && parsed <= 10000 ? parsed : 1;
  return { status, query, page };
}
export function parseConfiguration(form: FormData): Record<string, number | boolean | Record<string, number>> | null {
  const ranges: Record<string, [number, number]> = {
    driver_commission_percent: [0, 0], default_matching_radius_km: [1, 200],
    offer_timeout_seconds: [30, 600], scheduled_confirmation_hours: [1, 24], mock_route_speed_kph: [5, 120],
  };
  const result: Record<string, number | boolean | Record<string, number>> = {};
  for (const [key, [min, max]] of Object.entries(ranges)) {
    const raw = form.get(key);
    const value = typeof raw === 'string' && raw.trim() ? Number(raw) : NaN;
    if (!Number.isInteger(value) || value < min || value > max) return null;
    result[key] = value;
  }
  const weights: Record<string, number> = {};
  for (const key of ['distance', 'reliability', 'going_home', 'return_trip', 'idle', 'preferences']) {
    const raw = form.get(`weight_${key}`);
    const value = typeof raw === 'string' && raw.trim() ? Number(raw) : NaN;
    if (!Number.isInteger(value) || value < 0 || value > 1000) return null;
    weights[key] = value;
  }
  if (Object.values(weights).every(value => value === 0)) return null;
  result.matching_weights = weights;
  result.backup_driver_enabled = form.get('backup_driver_enabled') === 'on';
  return result;
}
