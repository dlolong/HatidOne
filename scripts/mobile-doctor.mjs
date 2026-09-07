import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const requested = process.argv[2];
if (requested && !['ios', 'android'].includes(requested)) {
  console.error('Usage: npm run mobile:doctor -- [ios|android]');
  process.exit(2);
}
let failures = 0;
function check(label, okay, detail) {
  console.log(`${okay ? 'OK' : 'MISSING'} ${label}: ${detail}`);
  if (!okay) failures++;
}
function command(binary, args) {
  const result = spawnSync(binary, args, { encoding: 'utf8', timeout: 15_000 });
  return { okay: result.status === 0, text: `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim() };
}
const [major, minor] = process.versions.node.split('.').map(Number);
check('Supported Node.js', (major === 22 && minor >= 13) || major >= 24, process.version);

if (!requested || requested === 'ios') {
  console.log('\niOS development build prerequisites');
  if (process.platform !== 'darwin') {
    check('macOS', false, 'Local iOS builds need a Mac with Xcode.');
  } else {
    const xcode = command('xcodebuild', ['-version']);
    const match = xcode.text.match(/Xcode (\d+)\.(\d+)/);
    const supported = !!match && (Number(match[1]) > 16 || (Number(match[1]) === 16 && Number(match[2]) >= 1));
    check('Xcode 16.1+', xcode.okay && supported, match?.[0] ?? 'Full Xcode is missing or not selected; Command Line Tools alone cannot run Simulator.');
    const simulator = command('xcrun', ['simctl', 'list', 'runtimes', 'available']);
    check('Installed iOS simulator runtime', simulator.okay && /iOS \d/.test(simulator.text), simulator.okay ? simulator.text : 'simctl unavailable. Install/select full Xcode and an iOS runtime.');
    const pods = command('pod', ['--version']);
    check('CocoaPods', pods.okay, pods.okay ? (pods.text.match(/^\d+\.\d+\.\d+/m)?.[0] ?? 'Installed') : 'CocoaPods is not available.');
  }
}

if (!requested || requested === 'android') {
  console.log('\nAndroid development build prerequisites');
  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || join(homedir(), process.platform === 'darwin' ? 'Library/Android/sdk' : 'Android/Sdk');
  check('Android SDK', existsSync(sdk), sdk);
  check('Android API 36 platform', existsSync(join(sdk, 'platforms', 'android-36')), 'Expo SDK 54 compiles against API 36.');
  check('Android build tools 36.0.0', existsSync(join(sdk, 'build-tools', '36.0.0')), 'Install through Android Studio SDK Manager.');
  const java = command(process.env.JAVA_HOME ? join(process.env.JAVA_HOME, 'bin', 'java') : 'java', ['-version']);
  const version = java.text.match(/version "(?:1\.)?(\d+)/);
  check('Java 17+', java.okay && !!version && Number(version[1]) >= 17, version ? `Detected Java ${version[1]}; Java 17 is the recommended baseline.` : 'Set JAVA_HOME to an installed JDK 17.');
  const suffix = process.platform === 'win32' ? '.exe' : '';
  const adb = command(join(sdk, 'platform-tools', `adb${suffix}`), ['version']);
  check('Android platform tools', adb.okay, adb.okay ? adb.text.split('\n')[0] : 'adb unavailable.');
  const avds = command(join(sdk, 'emulator', `emulator${suffix}`), ['-list-avds']);
  check('Android virtual device', avds.okay && !!avds.text, avds.okay && avds.text ? avds.text : 'Create an AVD in Android Studio Device Manager, or use an explicitly selected physical device.');
}
console.log(`\n${failures ? `${failures} prerequisite check(s) need attention.` : 'Native development prerequisites found.'} See docs/MOBILE_SIMULATOR_GUIDE.md. This command does not install or change system tooling.`);
process.exitCode = failures ? 1 : 0;
