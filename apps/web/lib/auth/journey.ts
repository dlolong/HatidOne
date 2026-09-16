import { safeReturnPath } from './redirects';

export type JourneyIntent = 'passenger' | 'driver';
export function parseIntent(value: unknown): JourneyIntent | null {
  return value === 'passenger' || value === 'driver' ? value : null;
}

// URL-carried intent survives reloads and confirmation emails across devices.
// It never supplies identity, role, approval, or authorization.
export function journeyDestination(intent: unknown, next?: unknown): string {
  const selected = parseIntent(intent);
  if (selected === 'driver') return '/driver-application';
  const destination = safeReturnPath(next);
  if (selected === 'passenger') {
    return /^\/(book|booking|passenger|history)(\/|\?|$)/.test(destination) ? destination : '/book';
  }
  return destination;
}

export function authJourneyHref(path: string, intent: unknown, next?: unknown): string {
  const query = new URLSearchParams();
  const selected = parseIntent(intent);
  if (selected) query.set('intent', selected);
  const destination = safeReturnPath(next);
  if (destination !== '/dashboard') query.set('next', destination);
  return query.size ? `${path}?${query}` : path;
}

export function journeyNotice(path: string, intent: unknown, next: unknown, kind: 'error' | 'message', message: string): string {
  const href = authJourneyHref(path, intent, next);
  return `${href}${href.includes('?') ? '&' : '?'}${kind}=${encodeURIComponent(message)}`;
}
