# Silicon Hustle v0.8 — Illustrated Results

A fictional AI hardware trading and startup management game.

## Run locally

Install Node.js 20+ and run:

```bash
npm install
npm run dev
```

Open the URL printed by Vite (typically http://localhost:5173).

## Features through v0.8

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

TypeScript/JSX transpilation and ZIP integrity were checked. Full browser interaction testing was not performed. A full dependency installation and browser/iOS runtime test were not completed in this environment.

## New in v0.8: contextual illustrations

- Each monthly investor update shows an SVG market performance illustration (rising, falling, or steady), tied to the combined operating profit and mark-to-market portfolio movement for that month. Exact dollar amounts remain visible in the report.
- Each boardroom verdict shows a distinctive illustrated boardroom victory or defeat scene, followed by financial impacts.
- The final magazine cover includes a visual matching the outcome: acquisition, fictional IPO, near-miss, hype, shutdown, graveyard, or fraud. If an exit is selected, the cover changes to the selected exit type.
- Graphics are lightweight, responsive inline SVGs, work offline and on iOS, and require no external image assets.
