# Silicon Hustle: iOS Development & Testing

## Project status

**iOS is the primary development and testing platform.** The web version remains available, but iPhone gameplay takes priority.

- Native app: Capacitor, React, TypeScript, and Vite.
- Bundle identifier: `com.siliconhustle.game`.
- Current Mac Mini development branch: `codex/account-saves-finish`. This is the current working branch, not a permanent production branch.
- Latest approved game commit: `97005c2e7f6bcee0d53f991a30161e44b70624df`.
- Version: `0.9.0`.
- 162/162 automated tests and the production build passed on MacBook Air; Capacitor iOS synchronization succeeded.
- Successfully launched and played on a physical iPhone.
- An in-place Xcode update retained existing local gameplay progress on the tested iPhone.
- Ad Hoc IPA archive/export completed for external device testing. External tester installation and gameplay are not yet verified.
- Native Google/email authentication and account switching still require physical-device validation.
- No App Store or TestFlight release yet.

## Two-Mac workflow

- **Mac Mini:** Codex development, automated tests, production builds, documentation, and approved Git commits/pushes in `/Users/gabe-visla-macmini/Documents/silicon-hustle-the-overlord`, currently on `codex/account-saves-finish`.
- **MacBook Air:** Review local changes and pull approved commits into `~/Projects/silicon-hustle`, then build, synchronize Capacitor, use Xcode for physical-iPhone testing, and archive/export Ad Hoc IPAs.

Confirm the approved game commit before building. Preserve the Air's local native files, signing settings, and existing device installation. Stop to review conflicting local changes rather than resetting, cleaning, or overwriting them. Do not mix in experimental Verified Rankings work.

## Requirements

- Mac with a compatible version of Xcode
- Xcode Command Line Tools
- Node.js compatible with the project's Vite version (Node 22.12+ or 20.19+)
- CocoaPods
- Apple Developer Program membership for Ad Hoc distribution
- An iPhone or iOS Simulator

## Build the iOS app

The `ios/` Capacitor project already exists in the repository.

**Do not run `npx cap add ios` to recreate it.**

On the MacBook Air, from the repository root, install dependencies and run automated checks when preparing the checkout:

```bash
npm ci
npm test
```

Then use the verified build/synchronization workflow:

```bash
npm run build
npx cap sync ios
open ios/App/App.xcworkspace
```

In Xcode:

1. Select the App target.
2. Use the existing working Apple development team under Signing & Capabilities. For a new setup, select your own authorized team; do not replace the Air’s working signing configuration.
3. Keep the existing bundle identifier unless a deliberate change is required.
4. Select an iOS Simulator or registered physical iPhone.
5. Build and run the app as an in-place update when testing an existing installation. Do not uninstall it or clear app data.

Always open `App.xcworkspace`, not `App.xcodeproj`, because the project uses CocoaPods.

After approved web changes, repeat `npm run build` → `npx cap sync ios` → open `ios/App/App.xcworkspace` before testing. The build creates production web assets; synchronization copies them and updates native dependencies. These commands do not deploy the web app or release an iOS build.

Review the native diff after synchronization. Preserve working signing and provisioning settings; do not reset native files merely to remove synchronization changes. If CocoaPods needs manual installation or repair, retain the existing troubleshooting step:

```bash
(cd ios/App && pod install)
```

Resolve pod/workspace problems before building, and continue to open the workspace rather than the project file.

## Physical iPhone testing

Successful launch and an in-place update preserving progress are already verified on the tested physical iPhone. For each new approved build, check the following; this list does not claim that every scenario below has passed:

- Start and resume a game.
- Buy and sell chips.
- Advance months and manage the AI lab.
- Test the Founder’s Gamble and applicable endings.
- Confirm THE OVERLORD and its fixed fictional Top 10 appear in Rankings. MOGABR’s featured value and #1 entry must both show `$203,718,617,301.68`.
- Close and reopen the app without losing progress.
- Test gameplay without an internet connection.
- Test an in-place app update while preserving local saves.

**Important:** An in-place update has successfully preserved progress on one tested iPhone. This does not guarantee recovery after uninstalling, reinstalling, or changing bundle identifiers.

## Ad Hoc distribution

For testing outside a directly connected development device:

1. Register the tester's iPhone UDID in the Apple Developer portal.
2. Ensure the device is included in the appropriate Ad Hoc provisioning profile.
3. In Xcode, select a suitable generic iOS device destination.
4. Choose Product → Archive.
5. In Organizer, distribute the archive using Ad Hoc distribution.
6. Export the signed IPA.
7. Verify the exported app's provisioning profile includes the tester's UDID.
8. Deliver the IPA using an appropriate installation service or other supported distribution method.

A signed Ad Hoc IPA archive/export has completed during testing. External tester installation and gameplay are **not yet verified**. Archive/export success alone does not establish that another device can install or play the app.

Treat third-party IPA distribution links as sensitive. Do not publish private testing links, personal Apple Developer credentials, signing material, provisioning secrets, or private device identifiers in the repository. Register and check UDIDs privately in the Developer portal and provisioning profile, not in documentation.

## Local saves and data safety

Silicon Hustle currently stores gameplay progress locally on each device.

- Gameplay does not require an account.
- Games do not synchronize between devices. Guest and each authenticated account have separate local games and Personal Best records; signing in is not a backup or a transfer mechanism.
- Online Rankings are not required for gameplay.
- Do not uninstall the app casually during testing.
- Do not change the bundle identifier without considering the effect on local data.
- Preserve recovery information and backups before experimenting with save migrations.
- Do not assume an app reinstall will restore saved progress.

The existing save and recovery logic should remain untouched during documentation-only updates.

## Rankings and authentication

THE OVERLORD displays a fixed fictional Top 10 and the selected profile’s local Personal Best. It makes no Supabase Rankings requests and is not a live competitive leaderboard. MOGABR remains #1 and Gabe M. #2; the featured MOGABR valuation matches #1 at `$203,718,617,301.68`.

Real online Rankings and score submission are unfinished and must not be described as released.

Optional Google and email authentication is implemented in shared code, including native integration, but native Google sign-in, email magic-link callbacks, and account switching still require physical-iPhone verification. Gameplay remains offline-first with no cloud gameplay synchronization.

### Native authentication validation

Before advertising native sign-in as verified:

1. Verify the existing registered custom callback scheme (`com.siliconhustle.game://auth/callback`); do not replace a working scheme or introduce universal links without a separate reviewed change.
2. Check the approved callback configuration in Supabase Auth. Do not change production settings as part of documentation or build work.
3. Preserve the existing native Google integration and browser/deep-link handling. Test the actual provider flows rather than assuming web OAuth behavior applies to iOS.
4. Verify incoming email authentication links handled using Capacitor's App plugin, including cold starts.
5. Test Google sign-in, email magic links, sign-out, and switching accounts on a physical iPhone. Check that Guest and account saves and Personal Best remain isolated, and earlier progress/recovery copies remain preserved.
6. Review Sign in with Apple requirements, identity linking, and account deletion before a public release.

Browser authentication redirects are not automatically compatible with a native Capacitor WebView.

Do not advertise native sign-in or cross-device account recovery as working until verified.

## Release checklist

Before App Store or TestFlight distribution:

- Validate gameplay, saves, and in-place updates on physical iPhones.
- Verify recovery/export behavior and document limitations.
- Test native authentication if it is included in the release.
- Complete real Rankings only when ready.
- Verify offline gameplay and reconnection behavior.
- Review safe areas, layout, app icons, and launch assets.
- Review privacy disclosures, account-related requirements, and App Store guidelines.
- Perform a separate release build and distribution review.

## Repository safety

Keep experimental native signing changes, provisioning files, IPA exports, and local backups out of commits unless they are intentionally required and reviewed.

Do not merge `codex/account-saves-finish` into `main` or deploy production changes without separate approval. The current development workflow does not authorize changing the installed iPhone app without a separately approved device-testing step.
