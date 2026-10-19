# Silicon Hustle — iOS build track (v0.9+)

The web version is deployed. iOS work proceeds in parallel with save safety and gameplay.

## First native build on a Mac

Requirements: recent Xcode, Xcode Command Line Tools, Node.js 20+, Apple ID. An Apple Developer Program membership is needed for App Store distribution.

```bash
git clone https://github.com/Mo-Gabr/silicon-hustle.git
cd silicon-hustle
npm install
npm run build
npx cap add ios
npx cap sync ios
npx cap open ios
```

Open the generated Xcode workspace, choose your development team and a unique bundle identifier, then run in Simulator or on an iPhone. After web edits: `npm run build && npx cap sync ios`.

## Auth caveat — do not ship OAuth as-is

The existing browser sign-in uses `window.location.origin` for redirects. In a native Capacitor WebView this is **not** a working production callback. Before distributing the iOS app:

1. Decide on a verified HTTPS universal-link callback domain (recommended) or a registered custom URL scheme.
2. Register the callback URL in Supabase Auth → URL Configuration.
3. Open the OAuth provider in the system browser, not a trapped WebView.
4. Handle the incoming app link using Capacitor's App plugin, extract the Supabase auth response and establish the session securely.
5. Test Google and email magic links on physical iPhone, including app cold start.
6. Add Sign in with Apple when required by Apple's third-party sign-in rules; verify identity linking and account deletion options.

**Guest play and local saves should work in the native shell before native OAuth is added.** Do not advertise iOS cross-device authentication as tested yet.

## Release checklist

- Confirm local save survives app termination and update.
- Confirm offline gameplay; reconnect must not download, replace, or synchronize the local game. Public Rankings may refresh separately.
- Verify safe-area insets, keyboard, small-screen layout, and splash artwork.
- Add native app icons and launch screen assets.
- Confirm iOS and web retain independent local games, including Founder’s Gamble achievements. Test local recovery copy export on a physical iPhone.
- Review privacy disclosures and App Store guidelines for account creation/deletion and social sign-in.
