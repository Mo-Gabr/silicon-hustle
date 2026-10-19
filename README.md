# Silicon Hustle

A fictional AI hardware trading and startup simulator. Start with **$5M cash** and a **$25M company valuation**, then work toward a **$100M valuation within 30 months**.

**One device. One game.** Progress saves and resumes locally. Accounts are optional; gameplay never waits for an online service.

[Play on the web](https://silicon-hustle.vercel.app)

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

## Rankings

Rankings remains an optional online feature, requested when you open Rankings: browse public scores without signing in, view your standard-game personal best, and compare against the separate **MOGABR developer benchmark of $74,610,431,012.27**. Optional sign-in can identify your existing published record.

**Score publishing and founder-name editing are paused in this release.** Their previous ownership check required a matching server save. Removing synchronization does not silently weaken that check or replace it with unverified account attribution. Existing published records are unchanged; a separate local-only attribution design is needed before publication resumes.

**Early Access · Rankings are based on player-submitted scores.** Scores are not independently verified. The benchmark is a developer reference, not a player submission.

## One device, one game

Play without an account, Supabase configuration, or connectivity. A new game is saved immediately; subsequent actions save automatically, and launching the app resumes the local game. There is no save-source picker, automatic import, or synchronization between devices. Signing in or out does not change the game.

Supported historical snapshots in `silicon-hustle-v04` and `compute-empire-v04` are read without rewriting them on launch. New progress is stored in `silicon-hustle-local-v1`; historical keys are never deleted or overwritten. When both exist, the local-only game is active. Presentation defaults can be supplied in memory, but money, completion state, and achievements are never fabricated. Returning to an older client may show the older historical snapshot rather than recent local-only progress.

An incompatible game blocks play instead of silently resetting. **Save a Copy** and **Try Again** offer a simple recovery path. An explicit fresh start first preserves original snapshots locally; failure to preserve them blocks the replacement. Explicit New Game resets also retain the previous snapshot. No automatic recovery imports are performed. Storage failures retain the previous game and show an error. Recovery copies consume device storage and are not automatically pruned.

Clearing browser/app storage or deleting the installed app can remove the game and recovery copies. Use one active window, keep exported copies private, and do not rely on an account as a backup. Existing remote data is neither downloaded, changed, nor deleted by this client. Native export and persistence across installation/update scenarios still need physical-iPhone validation.

| Feature | Supabase requirements |
| --- | --- |
| Gameplay, local saves, Founder’s Gamble and achievements | None |
| Public Rankings reads | Project URL, public key, and the deployed Rankings read RPC; no sign-in required |
| Viewing your existing published record | Optional configured Google/email authentication |
| Score publishing and founder-name editing | Paused; no submission requests are sent |

See [optional Rankings authentication](AUTH_SETUP.md). Existing SQL files are historical setup assets, not instructions to change production for this release. No schema change or migration is needed.

## Platforms and technology

- **Web:** React, TypeScript, and Vite, hosted on Vercel.
- **iOS:** Capacitor packages the same React interface and trading handlers in the native application. The app has been successfully installed and played on a physical iPhone through Xcode.
- **Backend:** Optional Supabase authentication and public Rankings reads.

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
- Games do not transfer between devices. Optional native Rankings sign-in, recovery export and local persistence across app updates/reinstallation still need physical-device validation.
- Older saves without a reliable previous-month price display **Unavailable** until a subsequent month transition provides a baseline.
- The iOS app is a development build run through Xcode, with no App Store or TestFlight release.

## Temporary iPhone save diagnostics

This branch currently builds a read-only inspection screen instead of mounting gameplay. Startup autosave, trading, resets, and recovery writes are therefore unavailable. Open **Account → Save Diagnostics** without signing in. The view reads only the three known gameplay keys and their original-snapshot archive; Copy Summary excludes full snapshots and account data. Valuation is calculated using current game rules; historical snapshots without a version show “Not recorded.” An unsupported snapshot is not evidence of corruption.

Install this inspection build over the existing app using the same bundle identifier; do not uninstall or clear app data. Use the existing iOS build/copy/Xcode workflow. Do not restore gameplay in this temporary build until the diagnostic results have been reviewed.
