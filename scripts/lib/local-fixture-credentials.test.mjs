import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFixturePasswords, validateFixturePasswords, fixtureSeedSettings, LOCAL_FIXTURE_EMAILS } from './local-fixture-credentials.mjs';

// Deterministic in-memory test values only: never generate real credentials,
// write .local-backend account files, or authenticate/provision fixture users.
function fictionalPasswords() {
  let sequence = 1;
  return createFixturePasswords(size => Buffer.alloc(size, sequence++));
}
test('prepares all fixture roles with distinct per-account values using independent entropy requests', () => {
  const values = fictionalPasswords();
  assert.equal(Object.keys(values).length, 10);
  assert.deepEqual(Object.keys(values), LOCAL_FIXTURE_EMAILS);
  assert.equal(new Set(Object.values(values)).size, LOCAL_FIXTURE_EMAILS.length);
  assert.ok(Object.values(values).every(value => value.length >= 24));
});
test('rejects missing or shared-password credential files instead of providing a fallback', () => {
  assert.throws(() => validateFixturePasswords({}), /distinct strong password/);
  assert.throws(() => validateFixturePasswords(Object.fromEntries(LOCAL_FIXTURE_EMAILS.map(email => [email, 'fictional-shared-value-only-for-unit-test']))), /distinct strong password/);
});
test('serializes actor-specific credentials solely into escaped local seed settings without logging', () => {
  const values = fictionalPasswords();
  values[LOCAL_FIXTURE_EMAILS[0]] = "fictional-test-value-with-an-apostrophe'";
  const previous = console.log;
  let logged = false;
  try {
    console.log = () => { logged = true; };
    const sql = fixtureSeedSettings(values);
    assert.ok(sql.startsWith("do 'begin perform set_config("));
    assert.ok(sql.includes("hatidone.seed_passwords"));
    assert.ok(sql.includes("apostrophe''''"));
    assert.equal(logged, false);
  } finally { console.log = previous; }
});
