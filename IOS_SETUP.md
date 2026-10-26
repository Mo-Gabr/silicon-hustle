# Building Silicon Hustle for iOS

Silicon Hustle packages the same React/TypeScript game used on the web in a Capacitor iOS application. Gameplay and saves remain local to the device; authentication is optional.

## Requirements

- macOS with Xcode and a compatible iOS SDK
- Xcode Command Line Tools selected for the full Xcode installation
- Node.js 22.12+ or a newer supported LTS release, with npm
- CocoaPods for the committed native dependency configuration
- An iOS Simulator or a connected, trusted iPhone
- Appropriate Apple development signing for physical devices; Apple Developer Program membership for Ad Hoc distribution

Check the selected developer tools before building:

```bash
xcode-select -p
xcodebuild -version
xcodebuild -showsdks
pod --version
```

Complete any setup requested by Xcode. The app's deployment target must be supported by the selected Xcode/iOS SDK. If Xcode reports an unsupported target, use a compatible toolchain or review a deliberate native target change; do not regenerate the project or upgrade dependencies as a workaround.

## Build the existing project

The repository already contains the Capacitor **`ios/` project**. Do not run `npx cap add ios` or replace the native project.

From the repository root:

```bash
npm ci
npm run build
npx cap sync ios
open ios/App/App.xcworkspace
```

- `npm ci` installs JavaScript dependencies from the lockfile.
- `npm run build` checks TypeScript and writes the web application to `dist/`.
- `npx cap sync ios` copies those assets into the existing native app and updates native dependencies using CocoaPods.
- The workspace includes the CocoaPods dependencies. Open **`App.xcworkspace`**, not `App.xcodeproj`.

Repeat the build and sync after web changes. Review the resulting native diff before committing; preserve intentional configuration and signing settings. These commands do not publish a website or submit an iOS release.

For optional sign-in, configure the public environment values before building and follow [AUTH_SETUP.md](AUTH_SETUP.md#native-ios-sign-in). Guest gameplay and fictional Rankings need no Supabase configuration.

## Run in Xcode

1. Open the workspace and select the **App** scheme.
2. Select a simulator or connected iPhone as the run destination.
3. For a physical iPhone, trust the computer and enable Developer Mode if requested by iOS.
4. Under **Signing & Capabilities**, select a team you are authorized to use and configure development signing. Automatic signing can manage provisioning when authorized.
5. Confirm that the development profile includes the device and that a valid signing identity with its private key is available.
6. Build and run.

The committed bundle identifier is `com.siliconhustle.game`. It identifies this app, not a signing team available to every developer. A separate developer's installation may require a separately registered app identifier and matching authentication configuration; treat that as an intentional configuration change, not an upgrade to someone else's installation.

To update an existing installation, preserve its bundle identifier, signing team and compatible application identifier/entitlements. Stop on an identity mismatch. Do not uninstall the app or clear its container to work around installation errors when local saves need to survive.

## Troubleshooting

- **Missing workspace or pod dependencies:** Confirm `npm ci` and Capacitor sync completed. If needed, run `(cd ios/App && pod install)`, retaining the existing dependency configuration and reviewing lockfile changes.
- **Wrong developer tools:** Check that `xcode-select -p` points to the intended full Xcode installation rather than standalone Command Line Tools.
- **Signing or provisioning failure:** Use Xcode's account and signing tools to check team access, certificate validity, private-key availability and device registration. Do not commit certificates, private keys or provisioning profiles.
- **Missing intermediate certificate:** Use Apple's standard certificate chain and default trust settings; do not force an untrusted development identity to “Always Trust.”
- **Stale plugin build:** After reviewing dependency changes, use Xcode's **Product → Clean Build Folder**, then rebuild the workspace. This is a build cleanup, not an instruction to erase the installed app.
- **Authentication callbacks:** Verify the configured URL schemes, OAuth clients and Supabase redirects using [AUTH_SETUP.md](AUTH_SETUP.md). A successful native build does not verify provider callbacks.

## Optional Ad Hoc distribution

Ad Hoc distribution requires the appropriate Apple Developer Program access, distribution signing and registered test devices.

1. Register each tester's iPhone UDID privately in the Apple Developer portal.
2. Ensure the intended devices are included in the Ad Hoc provisioning profile.
3. In Xcode, select a suitable generic iOS device destination and choose **Product → Archive**.
4. Open the archive in Organizer and use the available Ad Hoc distribution option to export a signed IPA.
5. Verify that the exported app uses the intended identity and its provisioning profile includes the test devices.
6. Deliver it through a supported installation method and confirm installation and startup on the target devices.

Menu labels can vary by Xcode version. Exporting an IPA does not establish that a tester can install it, and an IPA contains no backup of player saves. Keep device identifiers, signing material and private distribution links out of the repository. Ad Hoc export is separate from TestFlight or App Store submission.

## Local saves and data safety

- Guest and each account have separate games and Personal Best records on the same device.
- Authentication does not synchronize games or restore progress from another device.
- Clearing storage, uninstalling, or changing app identity can remove access to local progress and recovery copies.
- Preserve recovery copies and use disposable games for resets, save-format experiments and ending tests. Do not rely on a retained copy in the app's own container as an external backup.
- An in-place update should be checked for save continuity; it is not a guarantee of recovery after reinstallation.

## Release checklist

Before distributing a build:

- Run `npm test`, `npm run test:browser` and `npm run build`.
- Verify startup, save resume, buy/sell, AI Lab and month advancement on a physical device.
- Check Founder’s Gamble qualification, extension progression and Month 42 completion with disposable data.
- Verify local profile isolation, restart persistence and in-place update behavior.
- Check offline play, scrolling, safe areas, rotation, enlarged text and VoiceOver.
- Confirm THE OVERLORD's fictional Top 10 works without sign-in or leaderboard requests.
- If authentication is configured, test Google, email links, cold starts, sign-out and account switching on the device.
- Review app icons, privacy disclosures, account-related platform requirements and distribution signing separately.

See [README.md](README.md#building-for-ios) for the short setup path and [AUTH_SETUP.md](AUTH_SETUP.md) for account configuration. No cloud gameplay saves or live Rankings service is required.
