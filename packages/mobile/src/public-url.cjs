function publicHttps(value, name) {
  let url;
  try { url = new URL(value); } catch { throw new Error(`${name} must be a public HTTPS URL.`); }
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  const tunnel = ['exp.direct', 'trycloudflare.com', 'loca.lt', 'ngrok.io', 'ngrok.app', 'ngrok-free.app', 'ngrok-free.dev'].some(domain => host === domain || host.endsWith(`.${domain}`));
  if (tunnel || url.protocol !== 'https:' || url.username || url.password || url.port || host === 'localhost' || !host.includes('.') || /(^127\.|^10\.|^192\.168\.|^169\.254\.|^172\.(1[6-9]|2\d|3[01])\.|^0\.|:|\.local$|\.internal$|\.test$|\.exp\.direct$|\.ngrok[^.]*\.)/.test(host)) {
    throw new Error(`${name} must not target a local, private, or tunnel endpoint.`);
  }
}
function passwordRecoveryUrl(base, environment) {
  if (!base) return null;
  try {
    const url = new URL(base);
    if (url.username || url.password || !['https:', 'http:'].includes(url.protocol)) return null;
    if (!['development', 'demo', 'test'].includes(environment)) publicHttps(base, 'EXPO_PUBLIC_WEB_URL');
    // Never forward an arbitrary path, redirect, fragment or token from configuration.
    return new URL('/forgot-password', url.origin).toString();
  } catch { return null; }
}
module.exports = { publicHttps, passwordRecoveryUrl };
