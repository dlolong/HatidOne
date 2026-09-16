const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validatePreview, publicHttps } = require('./check-preview.cjs');
const staging = { EXPO_PUBLIC_APP_ENVIRONMENT: 'staging', EXPO_PUBLIC_SUPABASE_URL: 'https://fictional-project.supabase.co', EXPO_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_fictional_test_only' };
test('staging preview accepts public configuration without connecting to backend', () => assert.doesNotThrow(() => validatePreview(staging)));
test('preview rejects accidental production targeting', () => assert.throws(() => validatePreview({ ...staging, EXPO_PUBLIC_APP_ENVIRONMENT: 'production' })));
test('production requires an explicit production profile and environment', () => assert.doesNotThrow(() => validatePreview({ ...staging, EXPO_PUBLIC_APP_ENVIRONMENT: 'production' }, 'production')));
test('release rejects localhost, private URLs, credentials and tunnels', () => {
  for (const url of ['http://example.com', 'https://localhost', 'https://127.0.0.1', 'https://2130706433', 'https://10.1.2.3', 'https://192.168.2.3', 'https://172.17.2.3', 'https://[::1]', 'https://thing.local', 'https://thing.exp.direct', 'https://example.ngrok-free.app', 'https://user:pass@example.com', 'https://foo.trycloudflare.com', 'https://trycloudflare.com', 'https://foo.loca.lt', 'https://loca.lt', 'https://ngrok.io', 'https://exp.direct', 'https://localhost.']) assert.throws(() => publicHttps(url, 'URL'), url);
});
test('release rejects privileged key and public secret variables', () => {
  const jwt = `header.${Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url')}.signature`;
  for (const key of ['sb_secret_fictional', jwt, 'placeholder']) assert.throws(() => validatePreview({ ...staging, EXPO_PUBLIC_SUPABASE_ANON_KEY: key }));
  assert.throws(() => validatePreview({ ...staging, EXPO_PUBLIC_SERVICE_ROLE_KEY: 'fictional' }));
});
test('release rejects simulated provider mode', () => {
  assert.throws(() => validatePreview({ ...staging, EXPO_PUBLIC_DEMO_MODE: 'true' }));
  assert.throws(() => validatePreview({ ...staging, PAYMENT_PROVIDER: 'mock' }));
});

const { passwordRecoveryUrl } = require('../src/public-url.cjs');
test('password recovery uses only the fixed browser route without tokens or redirects', () => {
  assert.equal(passwordRecoveryUrl('https://hatidone.example.com/other?token=fictional#redirect', 'staging'), 'https://hatidone.example.com/forgot-password');
  assert.equal(passwordRecoveryUrl('http://localhost:3003', 'development'), 'http://localhost:3003/forgot-password');
});
test('password recovery fails closed for missing URL, unsafe schemes, user info and release localhost', () => {
  for (const [url, environment] of [[undefined, 'staging'], ['javascript:alert(1)', 'development'], ['https://user:pass@example.com', 'test'], ['http://localhost:3003', 'staging'], ['http://localhost:3003', undefined], ['https://foo.trycloudflare.com', 'production']]) assert.equal(passwordRecoveryUrl(url, environment), null);
});
