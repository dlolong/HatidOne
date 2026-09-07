import { cpSync, existsSync, mkdirSync, readdirSync, copyFileSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const stage = join(root, '.local-backend');
const action = process.argv[2] ?? 'start';
if (!['start', 'stop', 'status', 'reset', 'test', 'seed'].includes(action)) throw new Error('Use start, stop, status, reset, seed or test.');
mkdirSync(join(stage, 'supabase'), { recursive: true });
for(const directory of ['snippets','functions'])mkdirSync(join(stage,'supabase',directory),{recursive:true});
for (const name of ['config.toml', 'seed.sql']) {
  if (existsSync(join(root, 'supabase', name))) copyFileSync(join(root, 'supabase', name), join(stage, 'supabase', name));
}
// Local-only staging resolves the historical duplicate 0004 version without rewriting deployed history.
const migrationDir = join(stage, 'supabase', 'migrations');
rmSync(migrationDir, { recursive: true, force: true });
mkdirSync(migrationDir, { recursive: true });
readdirSync(join(root, 'supabase', 'migrations')).filter(name => name.endsWith('.sql')).sort().forEach((name, index) => {
  copyFileSync(join(root, 'supabase', 'migrations', name), join(migrationDir, `${String(index + 1).padStart(14, '0')}_${name.replace(/^\d+_/, '')}`));
});
if (existsSync(join(root, 'supabase', 'tests'))) cpSync(join(root, 'supabase', 'tests'), join(stage, 'supabase', 'tests'), { recursive: true });
const args = action === 'reset' ? ['db', 'reset', '--local'] : action === 'test' ? ['test', 'db']
  : action === 'seed' ? ['db', 'reset', '--local'] : [action];
if (action === 'seed') console.log('Seed recreates ONLY this local demo backend. Existing local demo records will be reset.');
if(action==='start')args.push('--exclude','imgproxy,edge-runtime');
if(action==='status' && process.argv.includes('--json'))args.push('--output','json');
const cliArgs = ['--yes', 'supabase@2.116.0', '--workdir', stage, ...args];
// The Linux CLI also supports older macOS hosts whose system ICU cannot run the current native CLI.
const useDockerCli = process.env.HATIDONE_DOCKER_CLI === 'true' || (process.platform === 'darwin' && process.env.HATIDONE_DOCKER_CLI !== 'false');
if(useDockerCli){const build=spawnSync('docker',['build','--quiet','--tag','hatidone-local-cli:1','--file',join(root,'scripts/Dockerfile.cli'),join(root,'scripts')],{stdio:['ignore','ignore','inherit']});if(build.status!==0)process.exit(build.status??1);}
const result = useDockerCli
  ? spawnSync('docker', ['run', '--rm', '--network', 'host', '-v', '/var/run/docker.sock:/var/run/docker.sock', '-v', `${root}:${root}`, '-v', 'hatidone-cli-cache:/root/.npm', '-w', root, 'hatidone-local-cli:1', 'npx', ...cliArgs], { stdio: 'inherit' })
  : spawnSync('npx', cliArgs, { stdio: 'inherit' });
process.exit(result.status ?? 1);
