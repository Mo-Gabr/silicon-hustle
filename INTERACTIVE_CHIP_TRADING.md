# Interactive chip trading review

Market cards and portfolio chip names open a desktop dialog or mobile bottom sheet. Orders require an explicit confirmation and call the existing `trade()` handler. Fees, rounding, affordability, realized gains, trade restrictions, and the 999-chip order limit remain unchanged. MAX uses the existing rounded buy-cost rule; ALL selects up to 999, with a visible explanation for larger holdings.

The panel separates monthly market performance from the player's position. Average purchase cost includes buy fees; unrealized and estimated realized gains include the selling fee. Holdings market value is before selling fees. Missing or unreliable price history or cost basis displays **Unavailable**.

NEXT MONTH adds an optional `previousMarket` snapshot containing the previous prices and the month they apply to. Existing saves remain readable without this field. The first month has no historical baseline. Missing or stale snapshots remain unavailable until the next advance; reset clears the snapshot. Market calculations and transactions are unchanged. Persistence is now local-only as described in README; accounts are optional for Rankings and do not change the game. No database migration is required.

## Verification

- `npm test`: calculation, legacy-save, transaction parity, Rankings, and existing save/authentication regressions.
- `npm run test:browser`: isolated synthetic desktop/mobile profiles; order confirmation, fees, MAX/ALL, invalid input, missing basis, monthly snapshot persistence/reset, keyboard focus, dismissal, blocked trades, and existing signed-in/signed-out behavior. External requests are intercepted; no production data is used.
- `npm run build`: production bundle.

Before release, manually check the sheet on a physical Capacitor iOS device, including the keyboard, rotation, safe areas, and VoiceOver. In a disposable local game, open a market chip, inspect both sections, buy and sell, dismiss/reopen, and advance a month to inspect the baseline. Opening or dismissing the panel does not save game state; confirmed trades and NEXT MONTH retain the existing save behavior.

Changes are prepared locally for review only. No commit, push, deployment, production score submission, or database operation is part of this work.
