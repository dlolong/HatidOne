# HatidOne mobile simulator guide

HatidOne uses Expo SDK 54, React Native 0.81.5, and local Expo development builds. Passenger and Driver are separate applications and can coexist. No EAS cloud account, maps key, push service, or payment provider is required.

| Application | Native identifier | App deep-link scheme | Metro port |
| --- | --- | --- | --- |
| Passenger | `ph.hatidone.passenger` | `hatidone-passenger` | 8081 |
| Driver | `ph.hatidone.driver` | `hatidone-driver` | 8082 |
| Admin / fleet / partner web | Browser | HTTP | 3003 |
| Local Supabase | Shared development backend | HTTP | 55321 |

The native apps include `expo-dev-client ~6.0.21`, the [SDK 54 supported version](https://docs.expo.dev/versions/v54.0.0/sdk/dev-client/). Their launchers let you choose the correct Metro server. Installing JavaScript dependencies does **not** install either native app.

## Audited machine and honest launch status

Audit date: September 7, 2026.

| Check | Actual result |
| --- | --- |
| macOS | 12.2.1; full Xcode absent, Command Line Tools selected |
| iOS Simulator | `xcrun simctl` unavailable; native iOS launch blocked |
| Android tools | adb 33.0.2, emulator 31.3.10, ARM64 Pixel 2 API 30 AVD available |
| Android emulator boot | Successfully booted the existing AVD as `emulator-5556` in read-only mode; `sys.boot_completed=1` |
| Installed Java | Java 11 and 8; native build needs a supported JDK, preferably 17 |
| Android compile tooling | Platforms 30, 31, 33 and build tools through 33 installed; API/build tools 36 missing |
| Installed HatidOne native apps | Neither application installed; custom-scheme launch attempts could not resolve an activity |
| Local Android connectivity | Scoped reverse mappings for 55321, 3003, 8081, 8082 verified on the selected emulator |
| GPS injection | Named-emulator `geo fix` accepted a Makati point; app-level GPS behavior remains unverified |
| Expo native configuration | Both apps generated iOS and Android projects using `expo prebuild --no-install`; compilation remains blocked by the toolchain |

Native app launch, native keyboard handling, device GPS, and SecureStore persistence are **not verified on this machine**. The working emulator alone is not an app launch. The audit emulator was stopped after these checks. No Xcode, Java, SDK, OS, or global package installation was performed during the sprint. Use the commands below after completing the missing local toolchain setup.

## Prerequisites and dependencies

Use a supported Node release matching the repository engine: Node 22.13+ in the 22 line, or Node 24+. The audited default shell had Node 23.2.0, which the repository does not support.

```sh
npm ci
npm run mobile:doctor
# Check one target independently:
npm run mobile:doctor -- ios
npm run mobile:doctor -- android
npm run mobile:check
```

`mobile:doctor` checks installed tooling and exits with a nonzero status when a prerequisite is missing. It does not install software, accept licenses, change `xcode-select`, or update shell configuration. `mobile:check` runs both apps’ TypeScript, ESLint, and Expo dependency checks. These checks do not replace a native simulator test.

For iOS, install full Xcode 16.1 or later and a compatible iOS Simulator runtime on a supported macOS version. Select that Xcode in its Locations settings, open it once to complete its normal setup, and install CocoaPods. Command Line Tools alone cannot run Simulator. Verify:

```sh
xcodebuild -version
xcrun simctl list devices available
pod --version
```

For Android, use Android Studio SDK Manager to install Android API 36, Android SDK Build-Tools 36.0.0, Platform-Tools, Emulator, and current command-line tools. Use JDK 17 and set `JAVA_HOME` and `ANDROID_HOME` for your own environment. Create an ARM64 AVD on Apple Silicon (or a suitable image for your host) in Android Studio → Device Manager. An existing API 30 emulator can run an SDK 54 app after it is built; compile SDK 36 is a **build** requirement, not the required emulator OS version. Gradle may also request the matching NDK/CMake components during the first native build.

```sh
java -version
adb version
emulator -list-avds
adb devices -l
```

See the [Expo SDK 54 platform matrix](https://docs.expo.dev/versions/v54.0.0/) and [React Native environment setup](https://reactnative.dev/docs/set-up-your-environment) for toolchain setup. Do not downgrade this project’s SDK merely to match the audited machine’s old system tools.

## Environment configuration and localhost

Start the existing HatidOne backend. Do not stop another project’s backend to make room.

```sh
npm run backend:start
npm run demo:env
```

`demo:env` preserves existing files. Check each app’s `.env` locally; do not print keys into issue reports or commit environment files. Only public Supabase URL and anon/publishable key belong in mobile configuration. Never use a service-role key.

For a local simulator setup, each mobile app should use:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:55321
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR_LOCAL_PUBLIC_ANON_KEY
```

The Driver app also needs the current web address to open document onboarding:

```dotenv
EXPO_PUBLIC_WEB_URL=http://127.0.0.1:3003
```

The generated files may already contain an older web port. Preserve your current web configuration and update this **public mobile URL** to the server you actually run; this sprint uses 3003. Restart Metro after changing `EXPO_PUBLIC_*` values. Do not use port 3000 when another application owns it.

| Target | Meaning of `127.0.0.1` | Recommended setup |
| --- | --- | --- |
| iOS Simulator | Development Mac | Use the local URLs above |
| Android Emulator | Android guest | Run the named-device reverse helper below |
| Physical Android over USB | Android device | The same reverse helper works for an explicitly selected authorized device |
| Physical phone over Wi-Fi | Phone itself | Use your computer’s LAN address for Supabase and web; keep devices on the same network |
| Supabase Cloud | Remote project | Keep its HTTPS URL; no Supabase port forwarding needed |

For Android, keep the same environment files used by iOS and forward only HatidOne’s four ports on the intended device:

```sh
adb devices -l
# Replace emulator-5554 with the device you actually intend to use.
npm run mobile:android:connect -- emulator-5554
adb -s emulator-5554 reverse --list
```

The helper requires a serial, validates it is connected, and maps only 55321, 3003, 8081, and 8082. It does not remove other mappings or modify app data. Re-run it after reconnecting or restarting the emulator. Without reverse mappings, the Android emulator host alias is `10.0.2.2`, so its Supabase URL would be `http://10.0.2.2:55321`; avoid switching a shared `.env` back and forth when testing both platforms together.

## Passenger iOS

```sh
xcrun simctl list devices available
open -a Simulator
npm run mobile:passenger:ios
```

The first command that builds the app generates its native iOS project, installs pods, compiles, installs `ph.hatidone.passenger`, and starts Metro on 8081. To select a simulator explicitly:

```sh
npm run mobile:passenger:ios -- --device
```

After a development build is installed, ordinary JavaScript/UI changes only need:

```sh
npm run mobile:passenger
# Or start Metro and open the installed iOS app together:
npm --workspace apps/passenger-mobile run ios:open
```

## Passenger Android

Open Android Studio → Device Manager and launch the intended AVD, or use its exact name from `emulator -list-avds`:

```sh
emulator -avd Pixel_2_API_30
adb devices -l
npm run mobile:android:connect -- emulator-5554
npm run mobile:passenger:android -- --device emulator-5554
```

Use your actual AVD name and serial. The native build installs `ph.hatidone.passenger`; Metro uses 8081. On later runs:

```sh
npm --workspace apps/passenger-mobile run android:open
```

## Driver iOS

```sh
open -a Simulator
npm run mobile:driver:ios -- --device
```

This installs `ph.hatidone.driver` and starts Metro on 8082. Passenger remains installed under its separate identifier. On later runs:

```sh
npm --workspace apps/driver-mobile run ios:open
```

## Driver Android

```sh
adb devices -l
npm run mobile:android:connect -- emulator-5554
npm run mobile:driver:android -- --device emulator-5554
```

This installs `ph.hatidone.driver` and uses Metro on 8082. On later runs:

```sh
npm --workspace apps/driver-mobile run android:open
```

## Development builds and running both apps together

The `ios:build` and `android:build` variants compile/install without starting Metro. Expo SDK 54 does not allow `--port` and `--no-bundler` together, so these variants deliberately omit `--port`. The app-level `ios` and `android` scripts invoke `expo run:ios` and `expo run:android`; they compile a native development client. The `ios:open` and `android:open` scripts start Metro and open an **already installed** development client. They cannot install a missing client. Native dependencies, plugin changes, app identity changes, and native permissions require another build; TypeScript and UI changes normally use Fast Refresh. See [Expo’s local build workflow](https://docs.expo.dev/guides/local-app-development/).

Build one native app at a time, especially while the local database is running. Do not run multiple Gradle/Xcode builds in parallel on a constrained machine. For the recommended Passenger iOS + Driver Android + browser operations setup:

```sh
# Build sequentially without starting extra Metro processes.
npm run mobile:passenger:ios:build
npm run mobile:driver:android:build -- --device emulator-5554
npm run mobile:android:connect -- emulator-5554

# Separate terminals after the builds finish:
npm run mobile:passenger
npm run mobile:driver
npm run dev
```

Open the installed Passenger and Driver launchers and choose their respective 8081 and 8082 servers. Open Admin/Fleet in the browser at `http://localhost:3003`. All three clients use the same Supabase development database. If a port is occupied, identify its owner and choose a port explicitly; never kill unrelated application processes.

For browser-only UI previews when native tooling is unavailable:

```sh
npm --workspace apps/passenger-mobile run web
npm --workspace apps/driver-mobile run web
```

Browser preview and JS exports do not verify native safe areas, native keyboards, GPS permission prompts, or native session storage.

## GPS simulation

On iOS Simulator, use Simulator → Features → Location → Custom Location. Set coordinates near the actual test pickup, then use the Driver app’s Update GPS control and set Available.

On Android Emulator, open Extended Controls (`…`) → Location and send a point or play a route. With an explicitly selected emulator, you can also send a point from the terminal (longitude comes first):

```sh
adb -s emulator-5554 emu geo fix 121.0244 14.5547
```

Use approximate Makati, NAIA, Tagaytay, or other existing local reference coordinates from the booking flow. Test moving toward pickup, the Going Home destination, and a return pickup after the outbound schedule. GPS changes location only: arrival, PIN validation, trip start, and completion remain deliberate server-authorized actions. Foreground updates run while the driver app is open and available. Background location is explicitly disabled in both native configs.

## Session persistence and flow checks

1. Sign in using a local seeded passenger or driver account, then close and reopen the app. Verify the session restores without re-entering a password.
2. Passenger: choose pickup/destination, schedule, vehicle, server fare, and confirm. Open Bookings and the assigned-driver card; verify the pickup PIN appears only when appropriate.
3. Driver: set Available, accept an eligible offer, open Trips, head to pickup, arrive, enter the passenger’s PIN, start, complete, and review Earnings.
4. Exchange an in-app pickup message; inspect Activity/unread state. Open the same booking from an unrelated account and verify access is denied.
5. Toggle Going Home and review route-compatible offers. Rebook a completed passenger trip.
6. At a small iPhone and Android screen size, focus the last form field: verify the keyboard does not cover the active field or action. Check bottom tabs, safe areas, scrolling, and large text settings.

These are native acceptance checks to execute after a real development build is installed, not a claim that they passed on the audited machine.

## Clearing mobile app state and reinstalling

Prefer the app’s Sign out action when testing authentication. Android app-local data can be cleared without touching other apps:

```sh
adb -s emulator-5554 shell pm clear ph.hatidone.passenger
adb -s emulator-5554 shell pm clear ph.hatidone.driver
```

Those commands remove the selected app’s local data and saved session. To reinstall a development build:

```sh
adb -s emulator-5554 uninstall ph.hatidone.passenger
npm run mobile:passenger:android -- --device emulator-5554

# Select the intended simulator UDID from simctl list first.
xcrun simctl uninstall YOUR_SIMULATOR_UDID ph.hatidone.driver
npm run mobile:driver:ios -- --device YOUR_SIMULATOR_UDID
```

On iOS, Keychain/SecureStore entries may survive app uninstall, so uninstalling is not a reliable logout test. Sign out first. For a fully clean test, create a dedicated simulator in Xcode, or use Erase All Content and Settings **only on that dedicated simulator**; erasing removes every app and account in that simulator. Do not reset a shared developer device.

## Resetting Metro cache

Stop only the relevant HatidOne Metro terminal, then restart it with its assigned port:

```sh
npm run mobile:passenger -- --clear
npm run mobile:driver -- --clear
```

Do not run these alongside an existing server on the same port. Native build cache cleanup is a different operation; Expo supports `--no-build-cache` when an actual native rebuild is warranted.

## Common errors and troubleshooting

| Symptom | Check / next action |
| --- | --- |
| “No development build installed” | Build that app once with its `mobile:*:ios` or `mobile:*:android` command. Opening Metro cannot install the client. |
| `simctl` / `xcodebuild` unavailable | Run `mobile:doctor -- ios`; install/select full supported Xcode and an iOS runtime. Do not expect Command Line Tools to include Simulator. |
| Gradle needs Java 17 or cannot find API 36 | Complete Android Studio/JDK setup; run `mobile:doctor -- android`. No SDK downgrade is needed. |
| Emulator never appears in `adb devices` | Open Device Manager, verify its image/architecture and hardware acceleration, then choose its actual serial. |
| App cannot reach local Supabase | Re-run the named-device reverse helper on Android, or use a LAN address on Wi-Fi. Check Supabase is running on 55321. |
| Driver documents link opens the wrong app | Correct `EXPO_PUBLIC_WEB_URL` to HatidOne’s current web port 3003, and restart Metro. |
| App opens the other Metro project | Choose the correct launcher entry: Passenger 8081, Driver 8082. Their native identifiers and schemes differ. |
| Environment changes do not appear | Stop the relevant Metro server and restart with `--clear`; Expo embeds public environment values into the JS bundle. |
| Invalid login or email confirmation | Verify the selected Supabase project and its seeded account/email confirmation settings. Mobile does not simulate authentication. |
| Login succeeds but profile cannot load | Verify migrations/profile bootstrap and account status in the local backend. Do not bypass RLS or change the app to use a service key. |
| Session disappears after relaunch | Test on a native development client; review SecureStore errors and explicitly verify sign-in/sign-out behavior. Browser storage is a separate path. |
| Red screen after a native package change | Rebuild the development client; restarting Metro alone does not add native modules. |

Supabase OAuth/email callback allow-lists, when used, must match the actual development host and the application’s configured deep-link scheme. This sprint preserves existing email/password auth and does not add a new external identity provider.
