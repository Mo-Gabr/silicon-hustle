# Changelog

## Unreleased

### Fixed

- MOGABR’s featured empire valuation now matches the fixed #1 Top 10 entry at $203,718,617,301.68, using the same source value and currency formatter.

- Personal Best now persists across separate games, resets and restarts, isolated for each authenticated account and Guest. Existing scoped snapshots and recovery copies seed the record without claiming unassigned legacy games.
- Account transitions invalidate stale save callbacks, including returning to the same account. Guest sign-out preserves previous Guest progress and its best; interrupted record writes do not block ordinary gameplay saves.
- Explicit legacy assignment retains existing recovery entries so archived Month 42 games remain available for the existing selection flow. Original legacy saves and archives remain untouched.

### Changed

- THE OVERLORD now follows the supplied financial-dashboard reference: one rounded dark-green panel, gold crown and accents, restrained sans-serif hierarchy, and matching card treatment on desktop and mobile.

- THE OVERLORD’s fictional empire valuation uses the fixed MOGABR ranking value, independent of gameplay and live leaderboard records.

- The RANKINGS destination is now THE OVERLORD, a fictional Coming Soon terminal starring MOGABR as the permanent Boss of Bosses. Active leaderboard/provider observation is disconnected; existing Rankings code, backend data, authentication, gameplay and local saves are unchanged.

### Added

- Six manually cycled system notices with an accessible Next Notice button and counter. THE OVERLORD supports mobile widths and enlarged text without network requests or persistent state.

### Fixed

- Removed the temporary diagnostic startup pause and Account diagnostic entry. Normal gameplay resumes without sign-in. A one-time choice recovers a valid historical Month 42 game or keeps the current local game, preserves both originals before activation, and remembers the choice across launches. Completed runs keep their original outcomes.

- The upper-left header shows the local game profile’s chosen founder/display name, including legacy name metadata, with “Founder” for unnamed games. It never substitutes an account or Rankings identity and does not change saved data.

### Removed

- Cloud-save synchronization, cloud/device selection, cloud recovery/account save controls, and the sign-in-oriented launch splash. Existing server data and historical local snapshot keys are retained.
- Score publishing and founder-name editing from the active local-only client, pending a separately reviewed attribution approach. Anonymous public Rankings and existing published records remain available.

### Added


- One-device local autosave and resume, including Founder’s Gamble decisions, frozen Month 30 results and achievements, with compatible historical snapshot loading.
- A compact incompatible-game recovery screen, preserved originals before explicit fresh starts, and storage/stale-window safeguards that keep the previous game on failure.

This initial baseline summarizes major features already completed. It does not assign release dates or version numbers.

### Added

- The Founder’s Gamble: newly successful Month 30 founders can lock their exit or choose one twelve-month enterprise chapter, with a frozen standard victory and Rankings peak.
- Build the Enterprise through customer bids, capacity and operations investments, with centralized balance parameters, recurring revenue, operating costs, service incidents, financial forecasts and monthly settlement reports. Shared React/TypeScript rules serve web and Capacitor iOS.
- Save-carried enterprise decisions, contracts, settlement ledgers, separate extension outcomes, sticky $1B Unicorn achievement, and the distinct Month 42 $2B/profitable-lab MOGABR achievement. No database migration; older-snapshot and older-client limitations are documented.
- Regression coverage for extension progression, valuation, cash outcomes, achievements, legacy saves, reload/cloud snapshots and standard Rankings isolation, plus deterministic balance simulations.

- Fictional AI hardware trading and startup simulation, including AI labs, monthly investor reports, boardroom crises, and exit outcomes.
- Interactive chip trading with Buy/Sell controls, monthly price changes, cost basis, holdings value, and fee-aware profit/loss.
- Global Rankings with personal bests, editable public founder names, manual score publishing, and the separate MOGABR developer benchmark. Rankings use player-submitted scores.
- Guest play and local saves, with optional authentication, Supabase cloud saves, and save-conflict choices when configured.
- A shared React application for the web and the committed Capacitor iOS project, with physical-iPhone gameplay through Xcode. Native authentication and cross-device cloud-save flows still need full validation; there is no App Store or TestFlight release.
- Repository-wide documentation requirements for future development.

### Changed

- How to Play now uses START BUILDING and a short $100M/30-month goal teaser. The optional extension introduces its challenge inline during the opening planning phase only; saved games restore the appropriate introduction state without new flags or extra screens.

- Clarified enterprise actions with LAND BIG CLIENT and SIGN MAJOR PARTNER, dynamic spend/gain/risk summaries, live unlock progress, and an explicit CLIENT SLOTS metric. All six opportunities remain visible; gameplay rules are unchanged.

- Compacted the Founder’s Gamble decision and enterprise gameplay into the existing terminal style: short choice copy, selectable action rows, three summary metrics, and collapsed financial Details. Large text reflows on narrow screens.

- Four valuation-based losing stories, with timing adapted to early exits and Month 42, and final values displayed in millions or billions. Original trading, lab economics, authentication and cloud-save infrastructure remain unchanged.

- Mobile gameplay puts Market first, with compact financial summaries, an expandable portfolio, and expandable Market Wire.
- Rankings uses a compact founder-name section, contextual publishing controls, and one Early Access disclosure beneath the leaderboard instead of repeated verification and version badges.

### Fixed

- Reserved iPhone safe areas outside decision/report overlays and protected status-bar/home-indicator regions while scrolling.
