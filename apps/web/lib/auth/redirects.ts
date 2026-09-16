const AUTH_CALLBACK_PATH = '/auth/callback';

export function authCallbackUrl(configuredSiteUrl: string | undefined): string | null {
  if (!configuredSiteUrl) return null;

  try {
    const siteUrl = new URL(configuredSiteUrl);
    if (siteUrl.protocol !== 'http:' && siteUrl.protocol !== 'https:') return null;
    if (siteUrl.username || siteUrl.password) return null;

    return new URL(AUTH_CALLBACK_PATH, siteUrl.origin).toString();
  } catch {
    return null;
  }
}

// Only application destinations are accepted. Authorization still happens at
// the destination; callbacks/auth endpoints and arbitrary public routes are not targets.
export function safeReturnPath(value: unknown): string {
  if (typeof value !== 'string' || value.length > 2048 || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u0020]/.test(value)) return '/dashboard';
  try {
    const url = new URL(value, 'https://hatidone.invalid');
    if (url.origin !== 'https://hatidone.invalid' || /%2f|%5c|%2e|%00/i.test(url.pathname)) return '/dashboard';
    const roots = ['dashboard', 'passenger', 'book', 'booking', 'history', 'driver-application', 'driver', 'fleet', 'admin', 'organizations', 'notifications', 'referrals', 'account'];
    if (!roots.some(root => url.pathname === `/${root}` || url.pathname.startsWith(`/${root}/`))) return '/dashboard';
    return `${url.pathname}${url.search}`;
  } catch { return '/dashboard'; }
}
