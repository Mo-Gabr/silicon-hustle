# Silicon Hustle

A fictional AI hardware trading and startup simulator for iPhone and the web, built with shared React and TypeScript gameplay.

## About the Game

Start with **$5M in cash** and a **$25M company valuation**. Buy and sell AI hardware, build your AI lab, and navigate boardroom crises to reach **$100M within 30 months**.

Reach the goal at Month 30 and choose whether to cash out or take **The Founder’s Gamble**: an optional 12-month **Build the Enterprise** chapter ending at **Month 42**. Land clients, expand capacity, and improve reliability as you pursue a billion-dollar company. Your recorded Month 30 victory stays intact regardless of the extended outcome.

## Features

- **Hardware trading:** Buy and sell simulated chips, follow monthly price movements, and manage your portfolio.
- **Interactive trading panel:** Tap a market card or portfolio holding for Buy/Sell controls, monthly changes, average purchase cost, position value, and fee-aware profit/loss.
- **Startup management:** Grow the AI lab, earn recurring revenue, respond to crises, and pursue an exit.
- **Build the Enterprise:** Choose a monthly focus, land pilots and larger contracts, and pursue Unicorn and Legendary MOGABR achievements.
- **Local saves:** Progress saves automatically and resumes on the same device. Normal gameplay works offline without an account.
- **Personal Best:** Retains your highest eligible company valuation and completed exit separately. The overall best shows how it was achieved and its month when known; older records keep their values without invented history. Accepted acquisition prices and IPO results qualify without changing spendable cash.
- **Optional accounts:** Guest and each authenticated account have separate local games and Personal Best records.
- **Personalized fictional Rankings:** MOGABR and Gabe M. keep #1 and #2; your local Personal Best can earn one place among #3–#10. Your name defaults to YOU; customize it without signing in, or clear/reset it to return to YOU. No scores are submitted online.

## Tech Stack

- React and TypeScript
- Vite for development and production builds
- Capacitor and the existing native iOS project
- Supabase for optional Google and email authentication
- Vercel-compatible web hosting

## Requirements

- Node.js **22.12+** or a newer supported LTS release, with npm
- Git and a full repository checkout; some regression tests compare historical commits
- Chrome or Chromium for browser regressions
- For iOS: macOS, Xcode with a compatible iOS SDK, and CocoaPods

## Getting Started

Clone the repository and install the locked dependencies:

```bash
git clone https://github.com/Mo-Gabr/silicon-hustle.git
cd silicon-hustle
npm ci
```

Start the development server and open the URL printed by Vite:

```bash
npm run dev
```

Run tests and create a production build:

```bash
npm test
npm run test:browser
npm run build
```

The browser suite uses disposable profiles and synthetic data. Set `CHROME_BIN` to your Chrome/Chromium executable if it is not found; the suite skips when no browser is available.

`npm run build` checks TypeScript and writes the web application to `dist/`. To preview that build locally:

```bash
npm run preview
```

## Optional Configuration

Guest gameplay, local saves, and fictional Rankings need no Supabase configuration. To enable account sign-in, copy the template:

```bash
cp .env.example .env.local
```

Replace the placeholders with your Supabase project's public configuration:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
```

Configure the Google/email providers and allowed callback URLs as described in [AUTH_SETUP.md](AUTH_SETUP.md). Native Google sign-in also depends on matching OAuth client and URL-scheme configuration; environment variables alone are insufficient.

These values are included in the client build. **Never use service-role keys, database passwords, or other secrets in `VITE_` variables.** Keep `.env.local` out of Git. Restart the dev server or rebuild after changing configuration.

Authentication selects a local profile; it does **not** enable cloud saves, cross-device progress, or live Rankings. No database migration is required for the current game's local-save or fictional-Rankings features.

<a id="ios-development"></a>

## Building for iOS

The Capacitor `ios/` project is already committed. Use it rather than regenerating the native project.

On a compatible Mac, from the repository root:

```bash
npm ci
npm run build
npx cap sync ios
open ios/App/App.xcworkspace
```

The build creates the web assets. Capacitor sync copies them into the native app and updates its native dependencies. Open the **workspace**, not the `.xcodeproj`, so CocoaPods dependencies are included.

In Xcode, select the **App** scheme and a simulator or connected iPhone. Physical-device installation requires appropriate Apple development signing and provisioning. Review changes produced by synchronization and preserve the existing app identity when updating an installation whose local saves you want to keep.

The deployment target must be supported by your Xcode/iOS SDK; check compatibility before building. See [IOS_SETUP.md](IOS_SETUP.md) for signing, provisioning, distribution, and troubleshooting guidance, and [AUTH_SETUP.md](AUTH_SETUP.md#native-ios-sign-in) for native authentication setup.

## Important Notes

- **Saves are device-local.** Signing in is not a backup. Signing out returns to a fresh Guest game after preserving earlier Guest progress locally; account games and Personal Best records remain separate.
- Clearing browser/app storage or uninstalling the app can remove saves and recovery copies. Recovery archives on the same device do not replace an external backup.
- Historical saves may require an explicit profile or game-selection choice. Incompatible saves offer recovery options rather than silently resetting progress.
- Monthly price history or cost basis that cannot be established reliably is shown as **Unavailable**.
- The game is fictional satire, not financial advice, and is not affiliated with the companies or publications depicted.

See [interactive trading documentation](INTERACTIVE_CHIP_TRADING.md) for panel behavior and [CHANGELOG.md](CHANGELOG.md) for change history.

## License

No project license is included in this repository. Public visibility does not grant permission to modify or redistribute the game; obtain permission from the rights holder before doing so.
