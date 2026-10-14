# Silicon Hustle v0.9 — Founder Welcome & Optional Accounts

A fictional AI hardware trading and startup management game.

## New in v0.9 — Founder welcome, guest play, and accounts

- **First-visit welcome:** A retro-styled “WELCOME, FOUNDER.” splash screen with startup satire and a “LET'S HUSTLE” button. Returning players go straight into the game.
- **Founder portrait:** The splash displays `public/founder.png` when uploaded. This image must be added separately.
- **Guest mode:** Play immediately without creating an account; progress continues to save locally.
- **Optional sign-in:** Google OAuth and passwordless email magic links using Supabase. Buttons become available after Supabase is configured.
- **Cross-device cloud saves:** Authenticated players can sync game progress using the protected `game_saves` table. When both a local and cloud save exist, the player chooses which one to keep.
- **Account access:** Sign-in/cloud-save entry point and sign-out option.
- **Security:** Supabase row-level security restricts saves to their owners. Do not expose a Supabase service-role key in client code.

**Setup required:** See [AUTH_SETUP.md](AUTH_SETUP.md) for Supabase configuration, environment variables, SQL schema, Google provider, redirect URLs, and founder portrait placement. The login and cloud-save features are **not operational until configured**. Guest mode needs no Supabase project.

**Deployment:** Vercel imports this repository as a Vite project (`npm run build`, output `dist`). Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as Vercel environment variables before redeploying to enable sign-in.

**iOS note:** Capacitor builds require native OAuth/deep-link validation, and Sign in with Apple may be required for App Store compliance when Google sign-in is offered.

## Run locally

Install Node.js 20+ and run:

```bash
npm install
npm run dev
```

Open the URL printed by Vite (typically http://localhost:5173).

## Core game features (v0.8)

- **Final edition overlay** automatically appears when Month 30 finishes or the company runs out of cash.
- A satirical business-magazine-style outcome: acquisition offers, fictional IPO eligibility, almost-made-it, hype machine, startup graveyard, or shutdown.
- **Every fourth month** a mandatory boardroom crisis occurs: activist investors, a hostile takeover attempt, or a shareholder vote.
- Three responses: pay to defend, negotiate with moderate risk, or call their bluff with greater risk. All financial costs and probabilities are visible.
- **New in 0.7.1:** A mandatory verdict screen after every boardroom decision shows success or failure, the choice made, cash spent, additional penalty, cash before/after, and valuation impact. Acknowledge it to see the monthly investor report.
- A monthly investor update is available after resolving each boardroom event.
- Game saves remain compatible with the earlier `silicon-hustle-v04` localStorage key. The older finished games should show the final cover when opened.
- Fraud/SBF ending is reserved for a future feature that introduces a deliberate fraud decision. Ordinary failure never triggers a criminal ending.

## Design notes

Starting cash: $5M; initial valuation: $25M; target: $100M; duration: 30 months.
Fictional acquirer names are used for parody only, not real offers or affiliations. The fictional IPO eligibility threshold is not a real exchange listing standard.

## Web build

```bash
npm run build
```

Publish the generated `dist/` folder or import the GitHub repository into Vercel using Vite defaults.

## iOS (on a Mac with Xcode)

```bash
npm install
npm run build
npx cap add ios
npx cap sync ios
npx cap open ios
```

Xcode is required to compile and run the iOS native wrapper. Keep `ios/` under version control after adding the platform.

## Testing status

v0.9 was committed to GitHub, but a successful Vercel production build and end-to-end authentication/cloud-save testing have not yet been verified. The previous v0.8 archive had only partial static validation; full browser/iOS runtime testing was not completed.

## New in v0.8: contextual illustrations

- Each monthly investor update shows an SVG market performance illustration (rising, falling, or steady), tied to the combined operating profit and mark-to-market portfolio movement for that month. Exact dollar amounts remain visible in the report.
- Each boardroom verdict shows a distinctive illustrated boardroom victory or defeat scene, followed by financial impacts.
- The final magazine cover includes a visual matching the outcome: acquisition, fictional IPO, near-miss, hype, shutdown, graveyard, or fraud. If an exit is selected, the cover changes to the selected exit type.
- Graphics are lightweight, responsive inline SVGs, work offline and on iOS, and require no external image assets.
