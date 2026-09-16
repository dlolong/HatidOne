import { spawnSync } from 'node:child_process';
const codeOnly = process.argv.includes('--code-only');
const checks = [
  ['environment safety tests', ['run', 'test:release-safety']],
  ['mobile preview configuration safety tests', ['run', 'test:mobile-preview']],
  ['typecheck', ['run', 'typecheck']], ['lint', ['run', 'lint']], ['unit tests', ['test']],
  ['web production build', ['run', 'build']], ['client output credential scan', ['run', 'check:build-secrets']], ['Expo compatibility', ['run', 'check:mobile']],
  ['database/RLS/transactions (disposable container)', ['run', 'test:db']],
];
let failed = false;
for (const [name, args] of checks) {
  console.log(`\nRUN ${name}`);
  const result = spawnSync('npm', args, { stdio: 'inherit', env: process.env });
  console.log(`${result.status === 0 ? 'PASS' : result.status === 2 || result.error ? 'BLOCKED' : 'FAIL'} ${name}`);
  failed ||= result.status !== 0;
}
for (const name of ['authorized deployed end-to-end journey', 'signed preview artifacts and installed no-Metro test', 'physical-device permissions / reconnect / account switching']) console.log(`BLOCKED ${name}: requires owner environment/device evidence; not executed by this command`);
if (codeOnly) console.log('NOT APPLICABLE release verdict: --code-only checks repository code; blocked release gates remain.');
else console.log('BLOCKED RC1 release: attach independent deployed and artifact/device evidence before release.');
process.exitCode = failed ? 1 : codeOnly ? 0 : 2;
