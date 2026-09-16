import { readEnvironment, validateEnvironment } from './lib/release-environment.mjs';
const release = process.argv.includes('--release');
const onlyWeb = process.argv.includes('--web');
const targets = [['web', 'apps/web/.env.local', false], ...(onlyWeb ? [] : [['passenger', 'apps/passenger-mobile/.env', true], ['driver', 'apps/driver-mobile/.env', true]])];
let failed = false;
for (const [name, path, mobile] of targets) {
  const issues = validateEnvironment(readEnvironment(path), { mobile, release });
  console.log(`${issues.length ? 'BLOCKED' : 'PASS'} environment ${name}${release ? ' release' : ''}`);
  for (const issue of issues) console.log(`  ${issue}`);
  failed ||= issues.length > 0;
}
process.exitCode = failed ? 1 : 0;
