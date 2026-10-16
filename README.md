# Silicon Hustle

A fictional AI hardware trading and startup simulator. Start with **$5M cash** and a **$25M company valuation**, then work toward a **$100M valuation within 30 months**.

[Play on the web](https://silicon-hustle.vercel.app)

## Gameplay

- Buy and sell simulated AI hardware from NVIDIA, AMD, and Intel.
- Advance with **NEXT MONTH** to move hardware prices and collect any AI lab profit.
- Monitor cash, holdings, portfolio profit/loss, and monthly investor reports. Company valuation is not the same as spendable cash.
- Invest in an AI lab from Month 4 to build recurring revenue and manage operating costs.
- Respond to activist investors, takeover attempts, and shareholder votes, with visible financial consequences.
- Pursue fictional acquisition offers or, when eligible, a fictional IPO at the end of the run.

Hardware prices, companies' offers, financial outcomes, and startup valuations are simulated for play. Silicon Hustle is satire, with no affiliation to the hardware makers, acquirers, or publications depicted.

## Interactive chip trading

Click or tap a Market card or an owned hardware name to open the shared trading panel: a compact desktop dialog or mobile bottom sheet.

The panel separates **Monthly Change** from **Your Position**. It shows the current and previous month's prices, dollar and percentage changes, quantity owned, weighted average purchase cost, holdings market value, and unrealized profit/loss. Missing or unreliable historical data displays **Unavailable**.

BUY and SELL include quantity controls, MAX buying, ALL selling, cost/proceeds previews, and explicit confirmation. Purchase cost includes the 1% buying fee; profit/loss estimates account for the 1% selling fee. Holdings market value is shown before selling fees. Orders retain the game's 999-chip limit, so ALL selects up to 999 units per order.

On mobile, Market appears before the collapsed My Portfolio section. Expand the portfolio for labeled financial details; tap a holding to trade without navigating away.

## Rankings

Rankings includes a global leaderboard, your personal best and published position, editable public founder names, and the separate **MOGABR developer benchmark of $74,610,431,012.27**.

Publishing is manual. **Publish Saved Peak** appears when an eligible, unpublished peak is available. Publishing checks the signed-in account and ownership of the matching cloud save; unresolved save choices or pending synchronization can block it. Contextual guidance and manual retry controls remain available. New games do not lower an existing published best.

**Early Access · Rankings are based on player-submitted scores.**

Scores are not independently verified. The benchmark is a developer reference, not a player submission.

## Accounts and saves

Guest play requires no account or Supabase project. Progress is saved locally on the current browser or device; clearing that storage removes the local copy.

With Supabase configured, optional Google sign-in or passwordless email sign-in enables cloud saves. When both local and cloud progress exist, the player chooses which to keep. Save conflicts also require a choice rather than being presented as a successful synchronization. Check Account for save status and resolve pending choices before publishing a score.

| Feature | Supabase requirements |
| --- | --- |
| Guest gameplay and local saves | None |
| Sign-in and cloud saves | Project URL, public key, configured authentication providers/redirects, and the protected `game_saves` table |
| Public Rankings reads | Project URL, public key, and the deployed Rankings read RPC; no sign-in required |
| Rankings publication and name changes | Configured Rankings submission RPC, authentication, and an eligible game matching the account's cloud save |

See [account and cloud-save setup](AUTH_SETUP.md). Database setup is separate from installing or building the client; do not reapply migrations to an already configured project. The existing Rankings migration is retained in `supabase/migrations/202610150002_billionaire_board.sql`.

## Platforms and technology

- **Web:** React, TypeScript, and Vite, hosted on Vercel.
- **iOS:** Capacitor packages the same React interface and trading handlers in the native application. The app has been successfully installed and played on a physical iPhone through Xcode.
- **Backend:** Supabase authentication, PostgreSQL cloud saves, and Rankings RPCs.

The package version is **0.9.0**. There is no App Store or TestFlight release.

## Local development

Use Node.js **22.12+** or **20.19+**, with npm.

```bash
git clone https://github.com/Mo-Gabr/silicon-hustle.git
cd silicon-hustle
npm install
```

For guest-only development, leave the Supabase variables unset. To enable account and Rankings features, copy the environment template and replace its placeholders with your own development project's URL and public publishable/anon key before starting:

```bash
cp .env.example .env.local
```

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
```

These are browser-visible configuration values. Never put service-role keys or database passwords in `VITE_` variables, and do not commit `.env.local`.

Start the app and open the URL printed by Vite:

```bash
npm run dev
```

Run automated checks and build the web app:

```bash
npm test
npm run test:browser
npm run build
npm run preview
```

The browser regression suite uses isolated profiles, synthetic data, and intercepted backend requests. It requires an installed Chrome/Chromium browser; its default path is Google Chrome on macOS. Set `CHROME_BIN` to another compatible executable if needed. Missing Chrome results in a skipped browser suite. Use a full Git checkout: regression tests compare against historical source commits.

The build type-checks TypeScript and generates `dist/`; `preview` serves that build locally. In Vercel, use `npm run build` and output directory `dist`. Account and Rankings features need the two public environment variables in each intended Vercel environment, including Preview when testing there; they are embedded at build time.

## iOS development

The native **`ios/` project is already committed**. Use the existing workspace; do not add the iOS platform again.

On a Mac, install full Xcode with the required iOS SDK/simulator, CocoaPods, and the npm dependencies above. Build the web assets, copy them into the existing native project, and open its workspace:

```bash
npm run build -- --mode production
npx cap copy ios
```

On a fresh checkout, install the project's native pods:

```bash
(cd ios/App && pod install)
```

```bash
open ios/App/App.xcworkspace
```

In Xcode, select the App scheme, configure your development signing team for a physical device, and choose an iPhone simulator or connected iPhone. Build and run from Xcode. After changing web code, repeat the production-mode build and `npx cap copy ios` before rebuilding the native app. Production mode selects Vite's build configuration; it does not deploy anything.

See the [iOS validation checklist](IOS_SETUP.md#release-checklist) and [trading panel behavior](INTERACTIVE_CHIP_TRADING.md) for additional development context. The commands above apply to the committed project; older first-time platform-creation instructions in the setup notes are historical.

## Current limitations

- Rankings uses player-submitted scores, not independently verified results or an anti-cheat system.
- Native authentication and cross-device cloud-save flows still need full validation. Successful physical-iPhone gameplay does not establish those flows as fully validated; save conflicts must be resolved deliberately.
- Older saves without a reliable previous-month price display **Unavailable** until a subsequent month transition provides a baseline.
- The iOS app is a development build run through Xcode, with no App Store or TestFlight release.
