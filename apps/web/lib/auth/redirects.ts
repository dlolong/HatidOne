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
