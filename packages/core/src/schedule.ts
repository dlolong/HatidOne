/** A datetime-local value entered in Asia/Manila, validated without rollover guesses. */
export function parseManilaSchedule(value: unknown): Date | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}:00+08:00`);
  if (!Number.isFinite(parsed.getTime())) return null;
  const roundTrip = new Date(parsed.getTime() + 8 * 3600_000).toISOString().slice(0, 16);
  return roundTrip === value ? parsed : null;
}
