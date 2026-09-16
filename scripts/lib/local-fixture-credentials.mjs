import { randomBytes } from 'node:crypto';

export const LOCAL_FIXTURE_EMAILS = [
  'passenger', 'driver', 'pending-driver', 'admin', 'fleet', 'partner',
  'corporate', 'rider', 'backup-driver', 'outsider',
].map(name => `${name}@hatidone.test`);

export function validateFixturePasswords(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid private local fixture account file.');
  const passwords = LOCAL_FIXTURE_EMAILS.map(email => value[email]);
  if (passwords.some(password => typeof password !== 'string' || password.length < 24 || password.length > 128) || new Set(passwords).size !== passwords.length) {
    throw new Error('Private local fixtures require a distinct strong password for every account.');
  }
  return Object.fromEntries(LOCAL_FIXTURE_EMAILS.map(email => [email, value[email]]));
}

export function createFixturePasswords(entropy = randomBytes) {
  // Called only by explicitly invoked local backend preparation. Nothing is
  // printed and no production/hosted Auth account is provisioned.
  return validateFixturePasswords(Object.fromEntries(LOCAL_FIXTURE_EMAILS.map(email => [email, `Aa1!${entropy(24).toString('base64url')}`])));
}

function sqlLiteral(value) { return "'" + value.replaceAll("'", "''") + "'"; }

export function fixtureSeedSettings(passwords) {
  const encoded = JSON.stringify(validateFixturePasswords(passwords));
  // PERFORM prevents set_config from returning the password map as query output.
  // Quote both SQL layers rather than using a user-collidable dollar delimiter.
  const body = `begin perform set_config('hatidone.allow_fictional_seed','true',false); perform set_config('hatidone.seed_passwords',${sqlLiteral(encoded)},false); end;`;
  return `do ${sqlLiteral(body)};\n`;
}
