# Silicon Hustle: iOS Development & Testing

## Project status

**iOS is the primary development and testing platform.** The web version remains available, but iPhone gameplay takes priority.

- Native app: Capacitor, React, TypeScript, and Vite.
- Bundle identifier: `com.siliconhustle.game`.
- Current testing branch: `ios-testing` on GitHub.
- Version: `0.9.0`.
- Successfully built and played on an iPhone.
- An in-place iPhone update retained existing game progress during testing.
- An Ad Hoc IPA has been exported for external device testing.
- No App Store or TestFlight release yet.

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

From the repository root:

```bash
npm ci
npm test
npm run build -- --mode production
npx cap copy ios
(cd ios/App && pod install)
open ios/App/App.xcworkspace
```

In Xcode:

1. Select the App target.
2. Configure your own Apple development team under Signing & Capabilities.
3. Keep the existing bundle identifier unless a deliberate change is required.
4. Select an iOS Simulator or registered physical iPhone.
5. Build and run the app.

Always open `App.xcworkspace`, not `App.xcodeproj`, because the project uses CocoaPods.

After changing web gameplay code, rebuild the web assets and copy them into the native project before testing.

Do not routinely run `npx cap sync ios` without reviewing the native changes it may introduce.

## Physical iPhone testing

Verify the following on the device:

- Start and resume a game.
- Buy and sell chips.
- Advance months and manage the AI lab.
- Test the Founder’s Gamble and applicable endings.
- Confirm THE OVERLORD appears in Rankings.
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

A signed Ad Hoc IPA has been exported during testing. Installation and gameplay on the external tester's device should be verified separately.

Treat third-party IPA distribution links as sensitive. Do not publish private testing links or signing material in the repository.

## Local saves and data safety

Silicon Hustle currently stores gameplay progress locally on each device.

- Gameplay does not require an account.
- Games do not automatically synchronize between devices.
- Online Rankings are not required for gameplay.
- Do not uninstall the app casually during testing.
- Do not change the bundle identifier without considering the effect on local data.
- Preserve recovery information and backups before experimenting with save migrations.
- Do not assume an app reinstall will restore saved progress.

The existing save and recovery logic should remain untouched during documentation-only updates.

## Rankings and authentication

THE OVERLORD is currently a fictional Rankings placeholder. It is not a live competitive leaderboard.

Real online Rankings and score submission are unfinished and must not be described as released.

Optional browser authentication exists, but native iOS OAuth callbacks and sign-in flows require additional testing and implementation before being advertised as supported.

### Native authentication requirements (future work)

Before enabling native iOS sign-in:

1. Choose a verified HTTPS universal-link callback or registered custom URL scheme.
2. Configure the callback URL in Supabase Auth.
3. Open OAuth providers in the system browser.
4. Handle incoming authentication links using Capacitor's App plugin.
5. Test Google sign-in and email magic links on a physical iPhone, including cold starts.
6. Review Sign in with Apple requirements, identity linking, and account deletion.

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

Do not merge the `ios-testing` branch into `main` or deploy production changes without separate approval.
