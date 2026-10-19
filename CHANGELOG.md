# Changelog

## Unreleased

This initial baseline summarizes major features already completed. It does not assign release dates or version numbers.

### Added

- Safe automatic save resume for identical saves, valid cloud-only saves, and device-only games after confirmed cloud absence. Durable account-specific local history permits syncing proven device continuations against an unchanged cloud snapshot.
- Account → Saved Games for manual review and recovery export, with locally preserved originals before replacements and conditional cloud writes that reject concurrent changes.

- Fictional AI hardware trading and startup simulation, including AI labs, monthly investor reports, boardroom crises, and exit outcomes.
- Interactive chip trading with Buy/Sell controls, monthly price changes, cost basis, holdings value, and fee-aware profit/loss.
- Global Rankings with personal bests, editable public founder names, manual score publishing, and the separate MOGABR developer benchmark. Rankings use player-submitted scores.
- Guest play and local saves, with optional authentication, Supabase cloud saves, and save-conflict choices when configured.
- A shared React application for the web and the committed Capacitor iOS project, with physical-iPhone gameplay through Xcode. Native authentication and cross-device cloud-save flows still need full validation; there is no App Store or TestFlight release.
- Repository-wide documentation requirements for future development.

### Changed

- Save selection is exceptional and titled CHOOSE YOUR SAVE, with compact source/month/valuation choices. Recovery export and details live in Account → Saved Games. Offline/read failures pause sync without treating the cloud as empty; device-only games require explicit consent before import into an unbound account.
- Device save failures keep the previous saved/game state and show a recovery notice instead of reporting a successful action.

- Mobile gameplay puts Market first, with compact financial summaries, an expandable portfolio, and expandable Market Wire.
- Rankings uses a compact founder-name section, contextual publishing controls, and one Early Access disclosure beneath the leaderboard instead of repeated verification and version badges.

### Fixed

- Save compatibility now accepts absent legacy presentation fields and nullable optional reports without changing original stored snapshots; game loading applies display defaults in memory and preserves unknown metadata.
- Unsupported game versions and unreadable fields receive specific explanations instead of being labelled damaged. Invalid or missing saves are not shown as selectable options, and unreadable snapshots are protected from automatic replacement.
- Local edits immediately show pending synchronization rather than briefly retaining a synced label.
