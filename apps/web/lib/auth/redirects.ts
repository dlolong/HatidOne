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

export function safeReturnPath(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u0020]/.test(value)) return '/dashboard';
  try { const url=new URL(value,'https://hatidone.invalid'); if(url.origin!=='https://hatidone.invalid')return '/dashboard'; return `${url.pathname}${url.search}`; } catch { return '/dashboard'; }
}
