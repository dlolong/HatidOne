import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateEnvironment } from './release-environment.mjs';
const base = { HATIDONE_ENVIRONMENT: 'staging', NEXT_PUBLIC_SUPABASE_URL: 'https://fictional.supabase.co', NEXT_PUBLIC_SITE_URL: 'https://fictional.example.com', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_fictional' };
test('staging public configuration passes without privileged credentials', () => assert.deepEqual(validateEnvironment(base, { release: true }), []));
test('rejects private and tunnel release endpoints', () => {
  for (const host of ['localhost', '127.0.0.1', '192.168.1.1', '172.16.0.1', '[::1]', 'preview.exp.direct']) assert.ok(validateEnvironment({ ...base, NEXT_PUBLIC_SUPABASE_URL: `https://${host}` }, { release: true }).length);
});
test('rejects demo mode even with production NODE_ENV', () => assert.ok(validateEnvironment({ ...base, HATIDONE_DEMO_MODE: 'true', NODE_ENV: 'production' }).length));
test('detects privileged names, secret keys and legacy service-role JWT without revealing them', () => {
  const token = `e30.${Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url')}.signature`;
  for (const override of [{ EXPO_PUBLIC_SERVICE_ROLE_KEY: 'sensitive' }, { NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_secret_fictional' }, { NEXT_PUBLIC_SUPABASE_ANON_KEY: token }]) {
    const issues = validateEnvironment({ ...base, ...override });
    assert.ok(issues.length); assert.ok(!issues.join().includes(token)); assert.ok(!issues.join().includes('sensitive'));
  }
});
test('tests cannot silently use a hosted target and CI cannot target production', () => {
  assert.ok(validateEnvironment({ ...base, HATIDONE_ENVIRONMENT: 'test' }).length);
  assert.ok(validateEnvironment({ ...base, HATIDONE_ENVIRONMENT: 'production', CI: 'true' }).length);
});
