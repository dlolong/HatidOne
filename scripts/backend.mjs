import { cpSync, existsSync, mkdirSync, readdirSync, copyFileSync, rmSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { publicBackendStatus } from './lib/backend-status.mjs';
import { createFixturePasswords, validateFixturePasswords, fixtureSeedSettings } from './lib/local-fixture-credentials.mjs';
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const stage = join(root, '.local-backend');
const action = process.argv[2] ?? 'start';
if (!['start', 'stop', 'status', 'reset', 'test', 'seed'].includes(action)) throw new Error('Use start, stop, status, reset, seed or test.');
if (['reset', 'seed'].includes(action) && !process.argv.includes('--confirm-local-reset')) {
  console.error('BLOCKED: this action deletes existing local demo records. Explicitly rerun with --confirm-local-reset only for a disposable local backend.');
  process.exit(2);
}
const previousAccountPath = join(stage, 'test-accounts.previous.json');
// Status/stop/test do not prepare seed files or generate/rotate account credentials.
if (['start', 'reset', 'seed'].includes(action)) {
mkdirSync(join(stage, 'supabase'), { recursive: true });
for(const directory of ['snippets','functions'])mkdirSync(join(stage,'supabase',directory),{recursive:true});
for (const name of ['config.toml']) {
  if (existsSync(join(root, 'supabase', name))) copyFileSync(join(root, 'supabase', name), join(stage, 'supabase', name));
}
// Private local fixture credentials are never printed or given to the CLI as arguments.
const accountPath = join(stage, 'test-accounts.json');
const replacing = ['reset', 'seed'].includes(action);
let passwords;
if (existsSync(accountPath) && !replacing) {
  try { passwords = validateFixturePasswords(JSON.parse(readFileSync(accountPath, 'utf8'))); }
  catch { throw new Error('Private local fixture account file is invalid. Preserve existing data; review the local setup before any explicit reset.'); }
} else {
  if (existsSync(accountPath) && !existsSync(previousAccountPath)) {
    copyFileSync(accountPath, previousAccountPath);
    chmodSync(previousAccountPath, 0o600);
  }
  passwords = createFixturePasswords();
  writeFileSync(accountPath, JSON.stringify(passwords, null, 2) + '\n', { mode: 0o600 });
}
chmodSync(accountPath, 0o600);
const stagedSeed = join(stage, 'supabase', 'seed.sql');
writeFileSync(stagedSeed, fixtureSeedSettings(passwords) + readFileSync(join(root, 'supabase', 'seed.sql'), 'utf8'), { mode: 0o600 });
chmodSync(stagedSeed, 0o600);
console.log('Local fixture credentials are stored privately in .local-backend/test-accounts.json; no credentials are printed. An existing backend is unchanged until an explicitly confirmed local reset.');
// Local-only staging resolves the historical duplicate 0004 version without rewriting deployed history.
const migrationDir = join(stage, 'supabase', 'migrations');
rmSync(migrationDir, { recursive: true, force: true });
mkdirSync(migrationDir, { recursive: true });
readdirSync(join(root, 'supabase', 'migrations')).filter(name => name.endsWith('.sql')).sort().forEach((name, index) => {
  copyFileSync(join(root, 'supabase', 'migrations', name), join(migrationDir, `${String(index + 1).padStart(14, '0')}_${name.replace(/^\d+_/, '')}`));
});
if (existsSync(join(root, 'supabase', 'tests'))) cpSync(join(root, 'supabase', 'tests'), join(stage, 'supabase', 'tests'), { recursive: true });
}
const args = action === 'reset' ? ['db', 'reset', '--local'] : action === 'test' ? ['test', 'db']
  : action === 'seed' ? ['db', 'reset', '--local'] : [action];
if (action === 'seed') console.log('Seed recreates ONLY this local demo backend. Existing local demo records will be reset.');
if (action === 'start') {
  // Studio and its metadata API are optional; keep the default stack smaller on shared Docker VMs.
  const excluded = ['imgproxy', 'edge-runtime'];
  if (process.env.HATIDONE_STUDIO !== 'true') excluded.push('studio', 'postgres-meta');
  args.push('--exclude', excluded.join(','));
}
if(action==='status')args.push('--output','json');
const cliArgs = ['--yes', 'supabase@2.116.0', '--workdir', stage, ...args];
// The Linux CLI also supports older macOS hosts whose system ICU cannot run the current native CLI.
const useDockerCli = process.env.HATIDONE_DOCKER_CLI === 'true' || (process.platform === 'darwin' && process.env.HATIDONE_DOCKER_CLI !== 'false');
const captureOptions = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024 };
if (useDockerCli) {
  const build = spawnSync('docker', ['build', '--quiet', '--tag', 'hatidone-local-cli:1', '--file', join(root, 'scripts/Dockerfile.cli'), join(root, 'scripts')], captureOptions);
  if (build.status !== 0) {
    console.error('BLOCKED: local CLI container preparation failed. Raw diagnostics are suppressed to protect credentials; check local Docker availability privately.');
    process.exit(build.status ?? 1);
  }
}
// Supabase start/reset/status may print service-role keys, database passwords or
// SQL context. Capture every action and never forward raw stdout/stderr.
const result = useDockerCli
  ? spawnSync('docker', ['run', '--rm', '--network', 'host', '-v', '/var/run/docker.sock:/var/run/docker.sock', '-v', `${root}:${root}`, '-v', 'hatidone-cli-cache:/root/.npm', '-w', root, 'hatidone-local-cli:1', 'npx', ...cliArgs], captureOptions)
  : spawnSync('npx', cliArgs, captureOptions);
if (result.status !== 0) {
  console.error(`Local backend ${action} failed (exit ${result.status ?? 1}). Raw CLI diagnostics are suppressed. Check Docker/tool availability and private local configuration; never paste credential-bearing CLI output into reports.`);
} else if (action === 'status') {
  try {
    const status = publicBackendStatus(result.stdout);
    if (process.argv.includes('--json')) console.log(JSON.stringify(status));
    else console.log(`Local API: ${status.API_URL}. Only public connection fields are exposed by --json.`);
  } catch {
    console.error('Local backend status could not be read safely. Raw CLI diagnostics are suppressed.');
    process.exit(1);
  }
} else console.log(`Local backend ${action} completed. Raw CLI output was suppressed to protect credentials.`);
if (result.status === 0 && ['reset', 'seed'].includes(action)) rmSync(previousAccountPath, { force: true });
process.exit(result.status ?? 1);
