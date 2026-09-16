import { readFileSync, existsSync } from 'node:fs';
import { parseEnv } from 'node:util';

export function readEnvironment(path) {
  return { ...(existsSync(path) ? parseEnv(readFileSync(path, 'utf8')) : {}), ...process.env };
}

export function validateEnvironment(env, { mobile = false, release = false } = {}) {
  const issues = [];
  const prefix = mobile ? 'EXPO_PUBLIC_' : 'NEXT_PUBLIC_';
  const environmentName = mobile ? 'EXPO_PUBLIC_APP_ENVIRONMENT' : 'HATIDONE_ENVIRONMENT';
  const environment = env[environmentName];
  if (!['development', 'demo', 'test', 'staging', 'production'].includes(environment)) issues.push(`${environmentName}: explicit environment required`);
  if (release && !['staging', 'production'].includes(environment)) issues.push(`${environmentName}: release requires staging or production`);
  for (const [name, value] of Object.entries(env)) {
    if (!/^(NEXT_PUBLIC_|EXPO_PUBLIC_)/.test(name)) continue;
    if (/SERVICE.?ROLE|SECRET|PRIVATE.?KEY|DATABASE_URL|PASSWORD|ACCESS_TOKEN/i.test(name)) issues.push(`${name}: privileged client variable forbidden`);
    if (typeof value === 'string' && value.startsWith('sb_secret_')) issues.push(`${name}: privileged key forbidden`);
    if (typeof value === 'string' && value.split('.').length === 3) {
      try {
        const payload = JSON.parse(Buffer.from(value.split('.')[1], 'base64url').toString());
        if (payload.role === 'service_role') issues.push(`${name}: service-role credential forbidden`);
      } catch { /* Non-JWT public values are allowed. This is inspection, never authorization. */ }
    }
  }
  const urlNames = [`${prefix}SUPABASE_URL`, ...(mobile ? [] : ['NEXT_PUBLIC_SITE_URL'])];
  for (const name of urlNames) {
    try {
      const url = new URL(env[name] || '');
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error();
      const privateHost = /^(localhost|127\.|0\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[::1\]|\[f[cd]|\[fe80)/i.test(url.hostname) || !url.hostname.includes('.') || /\.(local|internal|test)$/.test(url.hostname);
      if (release && (url.protocol !== 'https:' || privateHost || /exp\.direct|ngrok|trycloudflare/.test(url.hostname))) issues.push(`${name}: release requires public HTTPS without development tunnels`);
      if (environment === 'test' && !privateHost) issues.push(`${name}: automated tests must use an isolated local target`);
    } catch { issues.push(`${name}: valid URL required`); }
  }
  if (!env[`${prefix}SUPABASE_ANON_KEY`]) issues.push(`${prefix}SUPABASE_ANON_KEY: required`);
  const demoEnabled = env.HATIDONE_DEMO_MODE === 'true' || env.EXPO_PUBLIC_DEMO_MODE === 'true';
  if (demoEnabled && !['demo', 'test'].includes(environment)) issues.push('Mock mode requires an explicit demo or test environment');
  if (release && demoEnabled) issues.push('Mock mode forbidden in release builds');
  if (env.CI && environment === 'production') issues.push('CI must not target production');
  return [...new Set(issues)];
}
