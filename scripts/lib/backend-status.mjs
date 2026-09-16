// Status is an allowlist, never a pass-through of Supabase CLI diagnostics.
export function publicBackendStatus(output) {
  try {
    const text = String(output);
    const parsed = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
    const url = new URL(parsed.API_URL);
    if (url.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(url.hostname) || url.port !== '55321' || url.username || url.password) throw new Error();
    const key = parsed.ANON_KEY ?? parsed.PUBLISHABLE_KEY;
    if (typeof key !== 'string') throw new Error();
    if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) {
      const parts = key.split('.');
      if (parts.length !== 3 || JSON.parse(Buffer.from(parts[1], 'base64url').toString()).role !== 'anon') throw new Error();
    }
    return { API_URL: url.origin, ANON_KEY: key };
  } catch { throw new Error('Local backend status could not be read safely. Raw CLI diagnostics are suppressed.'); }
}
