# Changelog

## Unreleased

This initial baseline summarizes major features already completed. It does not assign release dates or version numbers.

Entries include historical capabilities as well as later changes and removals. Earlier cloud-save and live Rankings entries describe previous implementations, not the current local-only client; see README.md for current behavior.

### Added

- Compact enterprise progression path, explicit scheduled action/outcome and Operate/reset explanation, plus best-case insufficient-month warnings.

- Six manually cycled system notices with an accessible Next Notice button and counter. THE OVERLORD supports mobile widths and enlarged text without network requests or persistent state.
- One-device local autosave and resume, including Founder’s Gamble decisions, frozen Month 30 results and achievements, with compatible historical snapshot loading.
- A compact incompatible-game recovery screen, preserved originals before explicit fresh starts, and storage/stale-window safeguards that keep the previous game on failure.
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
- Completed Ad Hoc IPA archive/export for external testing. External tester installation and gameplay are not yet confirmed; there is no TestFlight or App Store release.

### Changed

- Major Partner now requires reliability 4 rather than 5; contract prerequisites, costs, success probabilities and the Month 30/42 gates remain unchanged. No reliability bonus for successful contracts is added.

- THE OVERLORD now follows the supplied financial-dashboard reference: one rounded dark-green panel, gold crown and accents, restrained sans-serif hierarchy, and matching card treatment on desktop and mobile.
- THE OVERLORD’s fictional empire valuation uses the fixed MOGABR ranking value, independent of gameplay and live leaderboard records.
- The RANKINGS destination is now THE OVERLORD, a fictional Coming Soon terminal starring MOGABR as the permanent Boss of Bosses. Active leaderboard/provider observation is disconnected; existing Rankings code, backend data, authentication, gameplay and local saves are unchanged.
- How to Play now uses START BUILDING and a short $100M/30-month goal teaser. The optional extension introduces its challenge inline during the opening planning phase only; saved games restore the appropriate introduction state without new flags or extra screens.
- Clarified enterprise actions with LAND BIG CLIENT and SIGN MAJOR PARTNER, dynamic spend/gain/risk summaries, live unlock progress, and an explicit CLIENT SLOTS metric. All six opportunities remain visible; gameplay rules are unchanged.
- Compacted the Founder’s Gamble decision and enterprise gameplay into the existing terminal style: short choice copy, selectable action rows, three summary metrics, and collapsed financial Details. Large text reflows on narrow screens.
- Four valuation-based losing stories, with timing adapted to early exits and Month 42, and final values displayed in millions or billions. Original trading, lab economics, authentication and cloud-save infrastructure remain unchanged.
- Mobile gameplay puts Market first, with compact financial summaries, an expandable portfolio, and expandable Market Wire.
- Rankings uses a compact founder-name section, contextual publishing controls, and one Early Access disclosure beneath the leaderboard instead of repeated verification and version badges.
- Aligned IOS_SETUP.md with the verified build → Capacitor sync → existing Xcode workspace workflow, retaining signing, provisioning, UDID registration and CocoaPods troubleshooting guidance.
- Documented the current Mac Mini development workflow on `codex/account-saves-finish` and the MacBook Air build, Capacitor synchronization, Xcode testing and IPA export workflow. At approved game commit `97005c2e7f6bcee0d53f991a30161e44b70624df` (application `0.9.0`), 162/162 automated tests and the production build passed on MacBook Air, and Capacitor iOS synchronization succeeded. Native Google/email authentication and account switching remain physical-iPhone validation tasks.

### Fixed

- Enterprise locked-action copy now shows every unmet requirement instead of hiding cash or capacity blockers behind contract/reliability progress.

- MOGABR’s featured empire valuation now matches the fixed #1 Top 10 entry at $203,718,617,301.68, using the same source value and currency formatter.
- Personal Best now persists across separate games, resets and restarts, isolated for each authenticated account and Guest. Existing scoped snapshots and recovery copies seed the record without claiming unassigned legacy games.
- Account transitions invalidate stale save callbacks, including returning to the same account. Guest sign-out preserves previous Guest progress and its best; interrupted record writes do not block ordinary gameplay saves.
- Explicit legacy assignment retains existing recovery entries so archived Month 42 games remain available for the existing selection flow. Original legacy saves and archives remain untouched.
- Removed the temporary diagnostic startup pause and Account diagnostic entry. Normal gameplay resumes without sign-in. A one-time choice recovers a valid historical Month 42 game or keeps the current local game, preserves both originals before activation, and remembers the choice across launches. Completed runs keep their original outcomes.
- The upper-left header shows the local game profile’s chosen founder/display name, including legacy name metadata, with “Founder” for unnamed games. It never substitutes an account or Rankings identity and does not change saved data.
- Reserved iPhone safe areas outside decision/report overlays and protected status-bar/home-indicator regions while scrolling.
- Verified successful physical-iPhone launch and an in-place Xcode update retaining existing local gameplay progress. Reinstallation recovery and other device/update combinations remain unverified.

### Removed

- Cloud-save synchronization, cloud/device selection, cloud recovery/account save controls, and the sign-in-oriented launch splash. Existing server data and historical local snapshot keys are retained.
- Score publishing and founder-name editing from the active local-only client, pending a separately reviewed attribution approach. Anonymous public Rankings and existing published records remain available.
