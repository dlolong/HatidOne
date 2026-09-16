import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publicBackendStatus } from './backend-status.mjs';

test('status emits only approved public fields and discards all private CLI diagnostics', () => {
  const input = JSON.stringify({ API_URL: 'http://127.0.0.1:55321', ANON_KEY: 'sb_publishable_fictional', SERVICE_ROLE_KEY: 'fictional-private-service', DB_URL: 'fictional-private-database', PASSWORD: 'fictional-private-password' });
  const result = publicBackendStatus(`untrusted diagnostic prefix\n${input}\ntrailing diagnostic`);
  assert.deepEqual(result, { API_URL: 'http://127.0.0.1:55321', ANON_KEY: 'sb_publishable_fictional' });
  assert.ok(!JSON.stringify(result).includes('private'));
});
test('malformed output and a privileged key in an anon slot fail without echoing values', () => {
  const privileged = `e30.${Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url')}.fictional`;
  for (const input of ['fictional-private-diagnostic', JSON.stringify({ API_URL: 'http://127.0.0.1:55321', ANON_KEY: privileged }), JSON.stringify({ API_URL: 'https://hosted.example.test', ANON_KEY: 'sb_publishable_fictional' })]) {
    assert.throws(() => publicBackendStatus(input), error => error.message === 'Local backend status could not be read safely. Raw CLI diagnostics are suppressed.');
  }
});
test('accepts a legacy public anon JWT only as a public connection field', () => {
  const anon = `e30.${Buffer.from(JSON.stringify({ role: 'anon' })).toString('base64url')}.fictional`;
  assert.equal(publicBackendStatus(JSON.stringify({ API_URL: 'http://localhost:55321', ANON_KEY: anon })).ANON_KEY, anon);
});
