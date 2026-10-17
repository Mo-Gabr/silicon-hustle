# The Founder's Gamble — Phase B implementation review

Status: Phase B approved by the user; implementation is local and uncommitted. The approved Phase A design and feasibility evidence are retained below as historical context. Base: `f5df658696f8158a468ff8d036b947e47f9828da`. Branch: `codex/founders-gamble`.

## Baseline architecture reviewed in Phase A

- `src/main.tsx` owns the shared React game state, deterministic market movement, transaction handlers, lab operations, month advancement, boardroom events, investor reports, and newspaper endings. There is no separate native game engine.
- `advance()` writes a monthly report and stops at Month 30. Otherwise, every fourth month creates a crisis. Bankruptcy takes precedence over the month limit. Lab upgrades unlock in Month 4 and cap at eight levels.
- `endingType()` prioritizes the reserved fraud ending, bankruptcy, IPO eligibility, acquisition at $100M, then the existing losing tiers. The $50M tier currently says “ALMOST A UNICORN.” The old formatter always uses millions; the final cover also hardcodes a 30-month denominator.
- Ordinary valuation is $20M + cash + gross holdings value + annual lab revenue × 3.25 + positive annual lab profit × 0.3. IPO eligibility additionally needs $150M valuation, $12M annual lab revenue, and positive lab profit. Acquisition offer text does not increase cash or valuation.
- Local saves are complete JSON snapshots. `AuthGate.tsx` synchronizes the same JSON to `game_saves`, using existing timestamp revisions and explicit cloud/device choices. Account and save infrastructure must remain unchanged unless separately approved.
- Rankings publishes manually after fresh identity and matching-cloud-save checks. Its observed score includes current valuation and all saved report peaks. The account cache retains verified peaks. Neither its public contract nor its SQL records run length. The SQL accepts only game version `0.9.0`.
- Capacitor packages the same `dist` build. `ios/App/App.xcworkspace` is committed; the Xcode application target is iOS 16. The currently selected developer tools are Command Line Tools, and `simctl` is unavailable in this environment.

## Economics assessment

Existing mechanics were exercised in an isolated, source-derived simulation in `/private/tmp`; no game saves, accounts, database, or repository implementation were changed. The experiment extended only the temporary engine's stopping limit to 42. Real fee rounding, integer quantities, 999-unit order batches, market bounds, lab costs/profit, and crises were retained.

Each strategy ran seeds 0–499. Strategies liquidate at monthly decisions, keep a $500K cash reserve, upgrade labs when affordable, and pay the $350K crisis defense when possible. Momentum chooses the previous month's strongest rising hardware; discount chooses the lowest price/base ratio. These simple strategies are illustrative, not an optimal-play analysis. The oracle knows next month's prices and selects the best fee-adjusted move or cash; it is deliberately unrealistic and is not a formal upper bound.

| Strategy, normal start | Median Month 42 | Maximum Month 42 | At least $1B | At least $2B with profitable lab at Month 42 |
| --- | ---: | ---: | ---: | ---: |
| Labs only | $198.23M | $198.23M | 0/500 | 0/500 |
| Momentum | $193.54M | $258.28M | 0/500 | 0/500 |
| Discount | $198.31M | $284.42M | 0/500 | 0/500 |
| Perfect-foresight oracle | $1.013B | $2.003B | 264/500 | 1/500 |

All these runs qualified at Month 30. The oracle's median Month 30 value was already $267.37M; its one $2B result started the extension at $395.56M. Its median full-run order count was 550, illustrating the repeated-order burden at large scale.

A second experiment started at an illustrative Month 30 company worth exactly $100M: $80M cash, no holdings or labs, and the corresponding seed's actual Month 30 market prices. Across the same 500 seeds, even the oracle did not reach $1B by Month 42 (median $612.70M; maximum $985.13M). This is one starting balance-sheet scenario, not proof that every $100M company is unable to reach $1B.

At eight labs, monthly profit caps at $2.16M, the valuation premium from labs is $138.816M, cumulative upgrade cost is $25M, and twelve months of operating profit is at most $25.92M. The total valuation then needs $841.184M of net assets for Unicorn, or $1.841184B for a $2B result.

Conclusion: the original economy does not make the new goals sufficiently accessible. The user has rejected treating Unicorn/MOGABR as near-impossible stretch goals. The dedicated scale-up proposal below replaces that recommendation; it does not change Months 1–30.

## Reviewed decisions — approved scope

- Preserve Months 1–30 and their standard Rankings behavior. Freeze the standard result at the Month 30 decision boundary; extended activity must never affect it.
- Preserve the recorded Month 30 success even if the extension loses valuation, exits early, or ends in bankruptcy. Record the extension outcome separately.
- Use the existing JSON/local/cloud persistence with no migration. Persist decisions and achievements and test restoring older snapshots; do not claim irreversible cross-device enforcement.
- Leave previously completed legacy runs finalized. Unfinished legacy runs can reach the new choice.
- Retain a Unicorn achievement once earned. MOGABR requires all conditions at Month 42, not merely an earlier peak.
- Adapt time-specific newspaper copy for the actual ending month.
- Use one shared TypeScript/React implementation for web and Capacitor iOS. Update README and CHANGELOG with the implemented feature, not ahead of its approval.
- The Months 31–42 company-building mechanic below was approved for Phase B and is now implemented locally.

## Proposed mechanic: Build the Enterprise

The player scales a managed AI services company through customer contracts, delivery capacity, and operational reliability. Existing lab income, chip trading, fees, price movement, crises, inventory limits, and the legacy valuation formula remain unchanged. Growth is an extension-only management layer activated after accepting the extension. The decision screen must disclose its base service overhead before acceptance; operating without new investment still pays that overhead. It grants no automatic financing, cash bonus, free revenue, or valuation multiplier on the existing company.

### Twelve monthly management choices

Choose one growth focus for each settlement into Months 31–42. The first focus can be planned after accepting the gamble at Month 30 and resolves on entry to Month 31; the last resolves on entry to Month 42. Selection shows costs and conditions but does not charge cash or grant rewards. NEXT MONTH validates and settles it once, alongside the existing monthly systems. Unaffordable or otherwise blocked plans must be changed or funded before advancement; a blocked transition charges nothing. Operating without a new initiative is always available.

| Focus | One-time cash cost | Requirements | Result / risk |
| --- | ---: | --- | --- |
| Launch pilot | $2M | One free delivery slot | 85% chance of a new $1.5M monthly recurring revenue contract |
| Win enterprise customer | $4M | Reliability 3+, two active pilots, one free slot | 65% chance of a new $2.5M monthly recurring revenue contract |
| Pursue strategic partnership | $8M | Reliability 5, two active enterprise customers, two free slots | 30% chance of a new $5M monthly recurring revenue contract |
| Expand delivery capacity | $6M | Installed capacity below 12 slots | Add two slots, capped at 12; increase recurring overhead |
| Improve operations | $3M | Reliability below 5 | Raise reliability one level; reduce incident risk and improve the new business's valuation multiple |
| Consolidate / operate | $0 | None | Preserve investment cash and serve existing customers; normal operating costs and incident risks still apply |

A failed customer bid consumes that month's focus and its acquisition cost, but adds no contract, slot usage, or recurring revenue. A retry is a deliberate choice in a later month, never an automatic retry. No player needs to predict future chip prices or discover a hidden seed to follow a successful growth route.

Initial reliability is 1. Installed delivery capacity is `min(12, 2 + floor(labs / 4) + purchasedSlots)`, reflecting existing lab infrastructure. Pilot/enterprise contracts use one slot each; strategic contracts use two. Existing lab upgrades remain available at their original costs and restrictions, without consuming the new growth focus; increasing labs can improve the shared infrastructure allowance. Capacity is a service commitment, not additional tradeable chips or a resellable asset. Capacity investment is not added back to cash or holdings value.

Contracts are separate, incremental customer revenue, not a second count of the legacy lab's revenue. They earn revenue only while the extension is active. A voluntary exit or Month 42 completion values the signed contracts as a going concern for the final record, then stops further collections; bankruptcy removes their premium. No renewal system is proposed in this first release. No further months, repeat gamble, or post-42 revenue collection are granted.

### Operating costs, service risk, and runway

For each settlement:

- Variable delivery expense is 40% of the new service revenue billed that month.
- Fixed service overhead is $200K per installed delivery slot plus $150K per reliability level per month. Idle capacity still costs money; overbuilding is a real mistake.
- New-business operating profit is billed service revenue minus those delivery and fixed costs. Add it to cash exactly once, alongside unchanged legacy lab profit. Existing crisis costs still apply.
- Monthly service-incident probabilities at reliability levels 1–5 are 18%, 12%, 8%, 4%, and 2% respectively. An incident reduces that month's new service billing by 20%, and discounts only the new business's valuation premium by 25% for the current and following settlement. Repeated incidents extend the discount; they do not stack multiplicatively. Contracts remain signed and continue to use capacity.
- Show the incident probability, monthly commitments, expected post-action cash flow, and estimated runway before confirmation. Paper valuation is not spending money. A cash-poor company can use existing hardware sales to raise runway; no speculative market profit is required by the successful examples below.
- If cash goes negative, preserve the existing bankruptcy ending priority, terminate the extension, and remove the new business's going-concern premium. The frozen standard win and any previously earned Unicorn badge remain recorded.

In Phase B, growth sales and incident outcomes would use the same shared deterministic integer PRNG on web/iOS, keyed by saved run seed, destination month, and separate event channels. Outcomes are not rerolled by reloading, changing screens, or toggling a choice. Existing market/crisis randomness is not changed. Restoring an older snapshot can still permit different choices with foreknowledge; that accepted limitation must be documented, not advertised as anti-cheat protection.

### Transparent valuation impact

For the extension only:

`extendedCompanyValue = unchangedLegacyValuation(currentCash, holdings, labs) + newServicesPremium`

`newServicesPremium = signedNewMonthlyRevenue × 12 × reliabilityMultiple × temporaryIncidentFactor`

| Reliability | New recurring-revenue multiple | Monthly incident probability |
| --- | ---: | ---: |
| 1 | 3× annual recurring revenue | 18% |
| 2 | 4× | 12% |
| 3 | 6× | 8% |
| 4 | 7.5× | 4% |
| 5 | 9× | 2% |

The incident factor is 0.75 during an active service discount and 1 otherwise. It applies only to the new premium; the premium is zero on bankruptcy. The service business has no premium before a successful customer contract. A failed bid creates no premium. Higher reliability increases the value of the new recurring contracts, not the existing lab or hardware portfolio.

The 3×–9× multiples are explicit, fictional game-balance parameters proposed for approval. They are not claims about real company valuations. New service cash profit is already included through cash; do not add it a second time to valuation. One-off costs, revenue, profit, the new ARR premium, and legacy valuation must be separately visible in reports.

### Concrete successful routes

A reachable, non-speculative standard winner from the original labs-only economy enters with $173.356M valuation, $14.54M cash, eight labs, and no holdings. It starts with four delivery slots. The following is a no-bid-failure/no-incident example, not a guaranteed result; costs and income are paid under the proposed rules throughout.

| Settlement month | Focus | New monthly recurring revenue after settlement | Reliability | Installed slots | Company value |
| --- | --- | ---: | ---: | ---: | ---: |
| 31 | First pilot | $1.5M | 1 | 4 | $227.466M |
| 32 | Second pilot | $3M | 1 | 4 | $282.126M |
| 33 | Improve operations | $3M | 2 | 4 | $317.986M |
| 34 | Improve operations | $3M | 3 | 4 | $389.696M |
| 35 | First enterprise customer | $5.5M | 3 | 4 | $569.906M |
| 36 | Second enterprise customer | $8M | 3 | 4 | $751.266M |
| 37 | Expand capacity | $8M | 3 | 6 | $750.576M |
| 38 | Improve operations | $8M | 4 | 6 | $896.736M |
| 39 | Improve operations | $8M | 5 | 6 | **$1.042746B — Unicorn** |

Consolidating for Months 40–42 finishes at **$1.057426B** in that clean example. This route leaves time for some failed bids or conservative cash management; the player is building recurring revenue and delivery capability, not relying on speculative price jumps.

The exceptionally difficult alternative uses the remaining three focuses:

| Settlement month | Focus | New monthly recurring revenue | Company value |
| --- | --- | ---: | ---: |
| 40 | First strategic partnership | $13M | $1.582406B |
| 41 | Expand capacity to eight slots | $13M | $1.584016B |
| 42 | Second strategic partnership | $18M | **$2.126626B — MOGABR-qualified** |

That full route spends **$52M** in growth acquisition/capacity/reliability investment, funded by initial cash and actual operations. It ends with **$23.81M cash**, **$18M new monthly recurring revenue**, a profitable original AI lab, and positive new-business operating profit. The final valuation consists of $20M startup component + $23.81M cash + $138.816M unchanged lab premium + $1.944B new-services premium. No perfect foresight, debt, free funding, fee changes, or successful hardware trades are used.

MOGABR is not automatically awarded for signing a partnership: final discounted valuation must still be at least $2B, the original AI lab must have positive monthly profit, the company must not be bankrupt, and the run must actually complete Month 42. A late failed bid or service incident can miss it. Early exit never awards MOGABR.

### Proposal-model feasibility testing

A temporary standalone planning model under `/private/tmp` was used, not application or native code. It simulated five policies across five starting balance sheets, with **5,000 seeds per scenario/policy: 125,000 synthetic runs**. Policies make choices from current state and public rules without future-price/outcome knowledge. Service sales and incidents use separate reproducible random draws in the planning experiment. Phase B must port the approved rules into one shared TypeScript module and test that implementation directly; these are proposal-model results, not feature or native certification.

Starting balance sheets were:

- Lab-led $173.356M: eight labs, $14.54M cash, no holdings; reachable through the original labs-only game.
- Lab-led $100M: four labs, $10.592M cash, no holdings.
- Cash-led $100M: no labs, $80M cash, no holdings.
- Illiquid lab-led $100M: four labs, $1M cash, $9.592M gross holdings.
- Illiquid asset-led $100M: no labs, $1M cash, $79M gross holdings.

The tested policies were idle, capacity-first overbuilding, pilot-led recurring growth, enterprise growth, and a strategic-partnership chase. Growth policies bought all remaining legacy lab levels only if the full cost, pending focus cost, and $2M reserve were affordable. The enterprise policy added another enterprise customer when needed to bridge a sub-$1B company. Unaffordable focuses became operate decisions. Holdings were kept at constant value and never traded, deliberately isolating the company mechanic; actual market variation will add another risk in the real game. Existing crisis cadence and affordable defense were retained, with the existing free/risky response if defense could not be afforded.

| Starting company / tested policy | Median ending value | Earned Unicorn during extension | MOGABR at Month 42 |
| --- | ---: | ---: | ---: |
| $173.356M / idle | $186.826M | 0% | 0% |
| $173.356M / overbuild first | $159.226M | 0% | 0% |
| $173.356M / pilot-led growth | $1.151B | 69.42% | 0% |
| $173.356M / enterprise growth | $1.051B | 90.42% | 0% |
| $173.356M / strategic chase | $1.040B | 90.62% | **2.74% (137/5,000)** |
| Lab-led $100M / enterprise growth | $961.680M | **42.80%** | 0% |
| Cash-led $100M / enterprise growth | $1.091B | 90.42% | 0% |
| Cash-led $100M / strategic chase | $1.080B | 90.62% | **2.74% (137/5,000)** |

The underfunded four-lab $100M company did not earn MOGABR under the tested policies; no universal $2B promise is made for every eligible starting balance sheet. The two illiquid scenarios earned neither achievement without liquidating holdings; the no-lab illiquid company exhausted cash. Capacity-first overbuilding could finish a $100M lab-led company at **$92.11M**, while its recorded Month 30 success remained $100M. These outcomes support showing liquidity/readiness information before the gamble, without adding a new eligibility restriction beyond the approved standard win.

These figures are tuning evidence, not universal player success rates or a proof of optimal play. Unicorn is intentionally accessible through excellent management; MOGABR remains a very low-probability, high-execution result. Balance testing in the shared implementation and human playtesting remain required before calling the values final. Invariants checked in the planning simulation included affordable acquisitions, capacity constraints, reliability/lab caps, and a Month 42 stop.

## Shared implementation proposal

1. Extract pure TypeScript progression/ending selectors into a shared module, used by React on both platforms. Keep transaction and valuation formulas unchanged.
2. Add the four requested losing stories at `<$25M`, `$25M–<$50M`, `$50M–<$90M`, and `$90M–<$100M`. Preserve special endings and format actual final valuations to two decimal places in millions or billions. Adapt elapsed-month copy for extended runs; the “THIRTY MONTHS” headline needs an approved Month 42/early-exit variant.
3. At a newly reached Month 30 success, persist the pending choice and frozen standard-run result before showing **YOU MADE IT. NOW WHAT?**. Bankruptcy/fraud and unsuccessful runs do not qualify. Both ordinary acquisition and IPO-eligible successes qualify.
4. Taking the exit retains the normal success and manual Rankings flow; it does not automatically submit a score. Extending preserves cash, holdings, cost basis, labs, reports, and other company state. It consumes the one extension and leaves the company at Month 30 until NEXT MONTH advances to 31.
5. Derive the run's limit from persistent state: 30 or 42. Keep crises and reports active, including Months 32, 36, and 40. Month 42 is terminal. Add a clear voluntary-exit action with an in-page confirmation; canceling changes nothing.
6. Track a local/save-carried Unicorn achievement when valuation reaches $1B during Months 31–42. Keep the approved badge even after a later loss, while basing the final newspaper on actual final performance. Proposed terminal precedence: fraud/bankruptcy first, then MOGABR, Unicorn, existing successful endings, and losing tiers. MOGABR requires actual Month 42 completion, final valuation at least $2B, and positive lab profit; early exit cannot award it.
7. Use shared React choice/confirmation/ending components with keyboard focus, safe-area spacing, scrolling, and 44px touch targets. No separate iOS economic rules, assets pipeline, or game implementation.

Likely files: `src/main.tsx`, new shared progression/ending and choice-panel modules, scoped styles, Rankings score-selection/attribution integration, unit tests, offline browser tests, `README.md`, and `CHANGELOG.md`. Existing static tests that freeze old gameplay source will need scoped updates for explicitly approved progression changes, while preserving transaction, authentication, save-infrastructure, and SQL assertions.

## Save compatibility and one-time decisions

Proposed optional JSON metadata records a run identifier, pending/exit/extend decision, frozen Month 30 valuation and standard peak, extension completion month, and achievement milestones. Continue using the existing local key and JSONB save column. Normalize missing metadata for old saves without clearing or rewriting their economic data just by opening them.

As approved, keep legacy completed games finalized; unfinished legacy games can reach the new choice normally. A pending decision in a new save must reload as pending. An extended decision remains consumed after early exit or Month 42 completion. Use persistent exit selection rather than a UI-only flag when restoring a finished run.

Accepted limitation: metadata alone prevents duplicate extensions in the current save, but the existing conflict UI can intentionally restore an older whole snapshot. An older native client can also apply its old Month 30 hard stop to an extended save. Strict, irreversible cross-device decisions cannot be guaranteed just by adding optional JSON fields. Native and web clients need the updated shared bundle, and cross-device/offline behavior needs an explicit decision before implementation.

No server ledger or migration will be introduced in this scope. The user has approved save-level persistence with these limitations. Test canonical snapshot restoration and explicit rollback behavior, and document that older clients and intentionally restored snapshots cannot provide irreversible enforcement.

Persist two separate outcomes: `standardResult` records the actual Month 30 valuation, standard eligible peak, success, and original successful ending; `extensionOutcome` records the eventual month, actual extended valuation, completion/early-exit/bankruptcy reason, and achievements. Continuing never overwrites `standardResult`. A bad extension must show the standard victory and its ranked result alongside the separate extended outcome, not rewrite the player's original run as a failure.

Proposed growth metadata stores installed additional capacity, reliability, signed contracts, incident-discount expiry, selected focus, and a settlement ledger keyed by destination month. Recompute totals from these records; do not grant revenue or costs again on load. Persist the run decision, settlement, cash change, milestone update, and any terminal extension outcome in the same normal JSON snapshot update. Test interrupted saves and explicit old-snapshot restores without promising crash-proof/server-atomic guarantees.

## Rankings recommendation

As approved, keep extended achievement recognition in the game/save initially, with no public extended leaderboard and no database migration. Freeze both the successful Month 30 result and its standard eligible peak at the Month 30 decision boundary. Once the player accepts the extension, even actions performed while the screen still says Month 30 are extension activity and cannot change that frozen record. Extended valuation and post-30 reports must never enter the standard observation, account peak cache, publication eligibility, or submission score. Preserve existing higher standard personal bests and the $74,610,431,012.27 developer benchmark.

Allow manual publication of the frozen standard result only after the existing full saved-snapshot/identity checks. UI copy should distinguish the Month 30 ranked result from current extended company performance. Unknown post-30 save formats must fail closed for standard publication. Version strings must not be repurposed as run categories.

This is client separation in an explicitly player-submitted system; the current SQL cannot independently prove run duration. A public extended category or server-enforced separation would need a separate approved contract/schema/security design. Do not modify existing entries or reapply the deployed migration.

## Phase B validation plan

- Boundary tests at all four losing thresholds and $100M, including cents/rounding and preserved special-ending precedence.
- Month 30 eligibility, both choices, reloading pending choice, exactly one extension, 30→31, blocked transitions, and Month 42 hard stop.
- Confirm/cancel early exit, preserved financial values and history, late loss/bankruptcy with the frozen standard victory intact, Unicorn milestone persistence, MOGABR priority and early-exit exclusion.
- All growth costs, gates, slot usage, public probabilities, incident billing/discount expiry, growth/legacy cash-flow separation, valuation multiple boundaries, and no double settlement on reload.
- Reproduce the budget-feasible Unicorn/MOGABR paths in shared TypeScript; simulate multiple starting balance sheets and failure/incident paths without foresight or hardware trading. Confirm no growth actions or new costs exist before accepting the extension.
- Legacy saves, local reload, synthetic cloud restore/conflict cases, old-client/stale-snapshot behavior, and duplicate decision/reward protection within the approved enforcement scope.
- Standard Rankings regression tests covering frozen scores, pre-30 personal bests, extended report exclusion, cached peak isolation, name changes, failures, and no automatic/duplicate submissions.
- Shared desktop/mobile UI tests at 390×844 and 320×568, full unit/browser suite, type checking and `npm run build -- --mode production`.
- With native tooling available: `npx cap copy ios`, build the committed workspace for a simulator, and run with disposable guest/test data. Do not add iOS again or touch another application. Physical-device testing remains a separate recorded check.

## Phase B implementation and validation

The approved company-building rules are implemented in `src/foundersGamble.ts`, with centralized `ENTERPRISE_BALANCE`. Shared React screens in `src/EnterprisePanel.tsx` and the existing main application serve web and Capacitor iOS. Normal transactions, lab formulas, authentication, cloud synchronization, schema and RPC contract remain unchanged. Standard Rankings observation is filtered through the frozen standard result before it can reach the account peak cache or submission path.

Optional save metadata records the pending/consumed choice, frozen standard victory/peak, growth state, monthly settlement ledger, retained Unicorn milestone and separate terminal extension outcome. Each successful transition uses the existing whole-snapshot save update. No re-settlement happens on load. Existing cloud revision/conflict behavior is preserved; choosing an older snapshot still rewinds progress by design. Legacy completed games remain completed.

The choice and early-exit confirmation use one shared accessible dialog. Native close handling must preserve a pending decision even if the browser reports a non-cancelable Escape event. Account/conflict overlays take priority over these dialogs. Growth reports separate investment, billed revenue, variable/fixed expense, operating profit, legacy value and new-services premium.

Application validation: 86 unit/regression tests pass. These retain byte-equality checks for authentication, save infrastructure, trading components, SQL and the submission contract; scoped checks protect original trading/lab helpers and crisis rules. The production-mode TypeScript/Vite build and `npx cap copy ios` pass. The copy updates ignored generated native assets only, not the native project or configuration source. Vite reports its existing large-chunk warning (~553KB minified main bundle); no build error.

Shared-engine balance tests cover 25,000 synthetic runs (5,000 per scenario) using the same deterministic integer PRNG shipped in the client. Prepared enterprise policy: 4,514/5,000 Unicorns (90.28%), no MOGABR. Prepared strategic policy: 4,506/5,000 Unicorns (90.12%) and 109/5,000 MOGABR (2.18%). Lightly funded four-lab $100M enterprise policy: 2,136/5,000 Unicorns (42.72%); cash-led enterprise policy: 4,514/5,000 Unicorns. The illiquid no-lab operate-only policy goes bankrupt in all 5,000 runs without liquidating hardware. Policies reserve a pending focus cost plus $2M before buying all remaining original labs, use current-state choices without future outcomes, and retain boardroom defenses/fallback risks. They are synthetic policy results, not universal win rates. A clean production-rules path verifies $23.81M ending cash and $2.126626B valuation, with Unicorn at Month 39 and MOGABR at Month 42.

The complete offline Chrome browser suite passes (83.7 seconds): original gameplay/cloud-save parity, chip trading, mobile layouts, Rankings reads, identity/ownership checks, failures/manual retries and name editing. Extension checks pass at 1280/390/320px, including pending decisions, Escape handling, reload, monthly settlement, cancel/confirm early exit, synthetic cloud restoration, and manual frozen-score publication. A final focused rerun also passes after adding saved-bankruptcy illustration and retained-Unicorn regressions. All backend traffic is intercepted against a synthetic `.test` project; there are no production requests. The shared-engine simulation uses production TypeScript rules and no hardware trading; its policies are illustrative and not promised player success rates. The prior 125,000-run proposal model above remains historical evidence, not the implementation's measured results.

Native limitation: the selected developer directory is `/Library/Developer/CommandLineTools`; `xcrun simctl` is unavailable. A shared production bundle does not certify WKWebView layout, VoiceOver, physical-device behavior, native authentication or real cross-device synchronization. Those require updated native builds and manual testing before release.

Manual review checklist:

1. Use a disposable browser profile/guest game, never an existing production cloud save. Run `npm run dev` and play through Month 30; confirm ordinary economics/trading and the four losing tiers.
2. Reach a new $100M+ Month 30 winner; reload the pending choice. Check cash/overhead disclosure, take the exit in one disposable run, and extend in another. Confirm no automatic score publishing.
3. In Build the Enterprise, plan pilots, improve reliability, win enterprise customers and add capacity. Compare the cash preview with reports; test insufficient cash, a failed bid, an incident and the 32/36/40 crises. Reload to confirm no repeated settlement.
4. Cancel an early exit and confirm no save change; then confirm in a disposable run. Check both the frozen standard victory and actual extension result. Check a late loss/bankruptcy retains standard success and any earned Unicorn badge.
5. Review the Month 42 hard stop and MOGABR eligibility. Synthetic automated routes cover the exact clean $2.126626B outcome; real bids are not guaranteed to succeed.
6. At 390×844 and 320×568, check focus selection, scrolling, financial labels, dialogs and keyboard focus. On an updated iPhone build, repeat with touch, large text, VoiceOver, orientation and safe areas.
7. In a separately approved disposable backend environment, validate cloud restoration/conflict choices across updated web/iOS clients. Do not test against production saves or publish production scores as part of this implementation review.

No database migration, production access, commit, push, merge or deployment is part of Phase B. Documentation updated: README.md, CHANGELOG.md and this plan.
