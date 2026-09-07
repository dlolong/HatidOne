import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const serial = process.argv[2];
if (!serial || !/^[a-zA-Z0-9._:-]+$/.test(serial) || process.argv.length !== 3) {
  console.error('Usage: npm run mobile:android:connect -- <device-serial>\nFind the intended device with adb devices -l. Only that device will be configured.');
  process.exit(2);
}
const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || join(homedir(), process.platform === 'darwin' ? 'Library/Android/sdk' : 'Android/Sdk');
const candidate = join(sdk, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb');
const adb = existsSync(candidate) ? candidate : 'adb';
function run(args) {
  const result = spawnSync(adb, ['-s', serial, ...args], { encoding: 'utf8', timeout: 10_000 });
  if (result.status !== 0) throw new Error(result.stderr?.trim() || result.error?.message || 'adb command failed');
  return result.stdout.trim();
}
try {
  if (run(['get-state']) !== 'device') throw new Error('The selected device is not connected and authorized.');
  // Named-device port mappings only: do not remove other projects' forwards.
  for (const port of [55321, 3003, 8081, 8082]) {
    run(['reverse', `tcp:${port}`, `tcp:${port}`]);
    console.log(`${serial}: localhost:${port} → development computer:${port}`);
  }
  console.log('Ready for local Supabase, HatidOne web, and both Metro servers. Re-run after reconnecting the device.');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Unable to connect the selected Android device.');
  process.exitCode = 1;
}
