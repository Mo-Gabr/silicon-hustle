# Silicon Hustle

Silicon Hustle is an AI hardware trading and startup simulator built primarily for **iPhone**, using Capacitor, React, TypeScript, and Vite.

Start with **$5M cash** and a **$25M company valuation**. Trade chips, grow your AI lab, survive the market, and try to reach a **$100M valuation within 30 months**.

**Three moves. One $100M exit.** Unless you decide $100M isn't enough.

**iOS is the development priority.** The web version remains available at [silicon-hustle.vercel.app](https://silicon-hustle.vercel.app).

**One device. One game.** Progress saves locally. Gameplay doesn't require an account or internet connection, and saved games do not synchronize between devices.

### Current status

- **iOS:** Successfully built and tested on a physical iPhone.
- **Distribution:** Ad Hoc IPA exported for external testing. No TestFlight or App Store release yet.
- **Save protection:** An in-place iPhone update successfully retained existing progress. Reinstallation and recovery remain separate validation tasks.
- **Rankings:** THE OVERLORD is a fictional placeholder. Live competitive rankings are not released.
- **Development branch:** `ios-testing`.

For native build instructions, see [IOS_SETUP.md](IOS_SETUP.md).
## Gameplay

- Buy and sell simulated AI hardware from NVIDIA, AMD, and Intel.
- Advance with **NEXT MONTH** to move hardware prices and collect any AI lab profit.
- Monitor cash, holdings, portfolio profit/loss, and monthly investor reports. Company valuation is not the same as spendable cash.
- Invest in an AI lab from Month 4 to build recurring revenue and manage operating costs.
- Respond to activist investors, takeover attempts, and shareholder votes, with visible financial consequences.
- Pursue fictional acquisition offers or, when eligible, a fictional IPO at the end of the run.

Hardware prices, companies' offers, financial outcomes, and startup valuations are simulated for play. Silicon Hustle is satire, with no affiliation to the hardware makers, acquirers, or publications depicted.

## The Founder’s Gamble and Build the Enterprise

The original 30-month economy, fees, hardware trades, lab upgrades, and crises remain unchanged. A newly completed Month 30 company worth at least **$100M** gets a choice: **Take the Money & Run**, or **Double Down** for one optional chapter ending at **Month 42**. Previously completed legacy saves stay completed.

Your **Month 30 victory and standard Rankings peak are frozen before the choice**. Extended gains, early exits, losses, and bankruptcy are recorded separately and never replace that standard result. Score publishing is paused in this local-only release; the frozen standard result is still preserved on the device. There is no separate public extended leaderboard.

In **Build the Enterprise**, choose a monthly focus: land pilots, win enterprise customers, pursue strategic partnerships, expand delivery capacity, improve reliability, or consolidate. Choices have personality—and consequences: customer bids can fail, idle capacity costs money, and service incidents hurt billing and valuation. Compact action rows show each investment’s cost and effect. The enterprise summary shows recurring revenue, capacity, and reliability; cash and valuation remain in the existing financial summary. Expand **Details** for operating costs, incident risk, valuation multiples, and cash-flow projections. The Month 30 choice and enterprise screens respect mobile safe areas and support larger text. Selecting a focus is planning; **NEXT MONTH** pays and settles it once. Unaffordable plans block advancement until changed or funded. Existing lab income and trading continue under their original rules.

- **Unicorn:** reach **$1 billion** during Months 31–42. Once earned, the achievement stays recorded even if valuation falls.
- **Legendary MOGABR:** actually finish **Month 42** at **$2 billion or more**, with a profitable original AI lab and no bankruptcy. An earlier peak or voluntary early exit does not qualify. This achievement is distinct from the Rankings developer benchmark.
- **Early exit:** confirm an exit to record the extended result and stop further months and revenue. Canceling does not change the game.
- **Dynamic losing endings:** four satirical stories reflect the final valuation, with timing adapted to the ending month. Bankruptcy and fraud retain priority.

Decisions, contracts, monthly settlements, achievements, and both outcomes stay in the local JSON game save. No database migration is required. A reload resumes that device’s game without replaying revenue, investments, or decisions. Restoring an older snapshot can rewind progress; an old app bundle may not understand the extension. Each browser profile and installed iOS app has its own independent game.

The same React screens and TypeScript rules power web and Capacitor iOS. Enterprise balance parameters live in `src/foundersGamble.ts` under `ENTERPRISE_BALANCE`. Contract and incident outcomes are deterministic per saved seed/month/channel; restoring an older snapshot can still allow decisions with foreknowledge. Financial multiples are fictional game balance, not investment guidance.

## Interactive chip trading

Click or tap a Market card or an owned hardware name to open the shared trading panel: a compact desktop dialog or mobile bottom sheet.

The panel separates **Monthly Change** from **Your Position**. It shows the current and previous month's prices, dollar and percentage changes, quantity owned, weighted average purchase cost, holdings market value, and unrealized profit/loss. Missing or unreliable historical data displays **Unavailable**.

BUY and SELL include quantity controls, MAX buying, ALL selling, cost/proceeds previews, and explicit confirmation. Purchase cost includes the 1% buying fee; profit/loss estimates account for the 1% selling fee. Holdings market value is shown before selling fees. Orders retain the game's 999-chip limit, so ALL selects up to 999 units per order.

On mobile, Market appears before the collapsed My Portfolio section. Expand the portfolio for labeled financial details; tap a holding to trade without navigating away.

## Rankings / THE OVERLORD

The **RANKINGS** navigation button opens **THE OVERLORD**, a fictional Coming Soon financial dashboard with a gold crown, dark-green panel and shared desktop/mobile visual identity. **MOGABR** is the permanent Boss of Bosses with an estimated empire valuation of **$999,999,999,999,999.99**. This is satirical presentation, not a verified player entry or a live leaderboard.

The **Top 10** is a fixed fictional list, not a live Supabase leaderboard. **Your Personal Best** is the highest eligible local valuation across games, including Founder’s Gamble through Month 42, kept separately for Guest and each account across new games and app restarts. Existing snapshots and scoped recovery archives can restore an earlier best; unassigned legacy games never count for an account automatically.

Cycle six system notices with **Next Notice**. The page works offline without Supabase configuration or sign-in, makes no leaderboard requests or score submissions, and does not write game or account storage. Existing Rankings implementation files, published records and founder names are retained unchanged; live browsing, publishing and name editing are not exposed by this page.

## One device, one game

Play without an account, Supabase configuration, or connectivity. A new game is saved immediately; subsequent actions save automatically, and launching the app resumes the local game. There is no save-source picker, automatic import, or synchronization between devices. Guest and each authenticated account have separate games stored only on this device. Signing in selects that account’s game; signing out starts a fresh Guest game after preserving earlier Guest progress in its recovery archive. Shared legacy games are copied only after an explicit ownership choice, and original keys are retained.

After explicit assignment, supported historical snapshots in `silicon-hustle-v04` and `compute-empire-v04` are read within the chosen profile without rewriting the original shared keys. New progress uses `silicon-hustle-local-v1` inside that profile’s account-scoped namespace; historical keys are never deleted or overwritten. When both exist, the local-only game is active. Presentation defaults can be supplied in memory, but money, completion state, and achievements are never fabricated. Returning to an older client may show the older historical snapshot rather than recent local-only progress.

Personal Best is local device data, not a verified online result or cross-device backup. Ordinary gameplay saves continue if optional record storage is unavailable; a reset that cannot preserve the outgoing record is stopped. Interrupted record updates can be recovered from retained snapshots, but clearing app storage removes local records too.

An incompatible game blocks play instead of silently resetting. **Save a Copy** and **Try Again** offer a simple recovery path. An explicit fresh start first preserves original snapshots locally; failure to preserve them blocks the replacement. Explicit New Game resets also retain the previous snapshot. No automatic recovery imports are performed. Storage failures retain the previous game and show an error. Recovery copies consume device storage and are not automatically pruned.

Clearing browser/app storage or deleting the installed app can remove the game and recovery copies. Use one active window, keep exported copies private, and do not rely on an account as a backup. Existing remote data is neither downloaded, changed, nor deleted by this client. Native export and persistence across installation/update scenarios still need physical-iPhone validation.

| Feature | Supabase requirements |
| --- | --- |
| Gameplay, local saves, Founder’s Gamble and achievements | None |
| THE OVERLORD placeholder and manual system notices | None; no leaderboard requests |
| Optional account sign-in | Configured Supabase Google/email authentication; not required for THE OVERLORD |
| Score publishing and founder-name editing | Paused; no submission requests are sent |

See [optional account authentication](AUTH_SETUP.md). Existing SQL files are historical setup assets, not instructions to change production for this release. No schema change or migration is needed.

## Platforms and technology

- **iOS (primary):** Capacitor packages the React, TypeScript, and Vite application for iPhone. Successfully built and tested on a physical device through Xcode. An Ad Hoc IPA has also been exported for external testing.
- **Web (secondary):** React, TypeScript, and Vite, hosted on Vercel.
- **Backend:** Optional Supabase authentication. Existing Rankings code and data are preserved, but the active THE OVERLORD placeholder does not make backend requests.

The package version is **0.9.0**.

**Release status:** iOS development and Ad Hoc testing. No App Store or TestFlight release yet.

For native setup, signing, and distribution instructions, see [IOS_SETUP.md](IOS_SETUP.md).

## Local development

Use Node.js **22.12+** or **20.19+**, with npm.

```bash
git clone https://github.com/Mo-Gabr/silicon-hustle.git
cd silicon-hustle
npm install
```

For guest-only development, leave the Supabase variables unset. To enable optional account features, copy the environment template and replace its placeholders with your own development project's URL and public publishable/anon key before starting:

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

The build type-checks TypeScript and generates `dist/`; `preview` serves that build locally. In Vercel, use `npm run build` and output directory `dist`. Optional account features need the two public environment variables in each intended Vercel environment, including Preview when testing there; they are embedded at build time.

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

See the [iOS validation checklist](IOS_SETUP.md#release-checklist) and [trading panel behavior](INTERACTIVE_CHIP_TRADING.md) for additional development context. The commands above use the existing native project. For the complete iOS-first workflow, including physical-device testing, Ad Hoc IPA distribution, signing, and save protection, see IOS_SETUP.md.

## Current limitations

- **Rankings:** Live competitive Rankings are not available. MOGABR is fictional, not a verified player score. Historical Rankings data remains separate from the active placeholder.
- **Local saves:** Games do not synchronize between devices. One in-place iPhone update successfully preserved progress, but reinstalling the app, recovering deleted saves, and transferring progress between devices remain unverified.
- **Authentication:** Native iOS sign-in and OAuth callbacks are not yet validated. Gameplay does not require an account.
- **Historical market data:** Older saves without a reliable previous-month price display **Unavailable** until a subsequent month transition establishes a baseline.
- **iOS distribution:** The app has been tested through Xcode, and an Ad Hoc IPA has been exported. External tester installation remains to be confirmed. There is no TestFlight or App Store release.


## Local save recovery after the diagnostic build

Normal gameplay and local autosave are restored. If a valid historical Month 42 game is hidden by an earlier local game, a one-time **Choose Your Game** screen recommends Month 42 and lets you keep either game. Nothing is replaced until you choose. Both original snapshots are retained in the local recovery archive before the selected game becomes active. The choice is remembered; subsequent launches resume normally. A completed Month 42 run stays completed, with its result and the normal New Game option preserved.

Install over the existing iPhone app using the same bundle identifier; do not uninstall or clear app data. Rebuild with `npm run build -- --mode production`, run `npx cap copy ios`, then run the existing app from Xcode. No sign-in, cloud synchronization, or diagnostic screen is required to play.
