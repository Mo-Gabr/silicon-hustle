# Billionaire Board: leaderboard-only release review

Base: GitHub main `62aa1706d2f5bfb97b56483fda4c1cf0d656f53d` (verified read-only).
Local release branch: `leaderboard-release`. Changes are uncommitted for review.
`main` and `leaderboard-development` refs are unchanged.

## Release behavior

- Adds the Billionaire Board tab, real public rankings, own best/rank, developer benchmark, milestones and public-name controls.
- Publishing is manual for both first joins and later score/name updates. There is no background publisher, automatic submit on login, timer or reconnect retry.
- Each manual publication verifies the authenticated identity, reads that account's own cloud save through the existing Data API, compares the full JSON snapshot with the currently displayed and locally persisted game, and checks identity/game again. Account switching, guest/anonymous-auth sessions, unsynced games, missing cloud saves and conflicting snapshots block publication.
- The SQL expected-user-ID argument binds the final write to the verified account even if the SDK token changes afterwards.
- Publishes the rounded current valuation or higher recorded report valuation in the verified saved snapshot. Previously verified account peaks and server bests are preserved in a separate board-only cache. Never attributes an unverified observation to the current account.
- Temporary offline/intermediate peaks that were never verified or recorded in saved reports are not carried over from the full development implementation. A game must first sync through main's existing save flow. A player may need to resolve the existing Account save choice, wait for sync, then click publish again.
- Additional per-publication save reads are read-only and introduce no new save synchronization or recovery behavior.

## Exact inventory versus main (11 files)

| File | Change |
| --- | --- |
| package.json | Adds test and test:browser scripts; dependencies/build unchanged |
| src/main.tsx | Adds board import/provider/tab and a read-only state observation effect; existing loader, actions, save persistence, valuation and reset functions unchanged |
| src/BillionaireBoard.tsx | Board UI/auth subscription/read RPC/manual publish integration; read-only account-save attribution |
| src/boardAttribution.ts | Canonical snapshot equality and fresh identity/ownership checks; no storage or database writes |
| src/leaderboardCore.ts | Public response handling, ranking, naming, cooldown, isolated account peak cache and controller |
| src/leaderboard.css | Board-scoped styles only |
| supabase/migrations/202610150002_billionaire_board.sql | Exact previously deployed SQL retained for history; DO NOT RUN AGAIN |
| tests/leaderboard.test.mjs | Board controller/ranking/privacy/error regressions |
| tests/attribution.test.mjs | Attribution/account-switch/error tests and baseline save-function/schema invariants |
| tests/browser-release.mjs | Offline baseline-versus-release browser parity and mocked board API tests |
| LEADERBOARD_RELEASE.md | Scope, evidence, limitations and release checklist |

No AuthGate, save schema, save validation, sync engine, conflict UI, recovery behavior, auth CSS, mobile redesign, iOS project, environment/configuration or lockfile changes.
The paused `202610150001_save_revision_guard.sql` and new `src/saveSync.ts` are absent from this branch.

The deployed board migration SHA256 is
`3165d898173200615c76d45774e0a21b7f7ed2ad66dec732b0022f222408719c`.

## Validation

Run `npm test`, `npm run test:browser`, and `npm run build`.
The comparison tests require the baseline Git object `62aa170` to be available (use history containing main when running in CI). No credentials or database are needed.
The browser test uses existing Chrome (`CHROME_BIN` can select another installed Chromium), Vite's existing esbuild dependency, fresh temporary profiles, synthetic sessions, a `.test` Supabase origin, blocked external DNS and interception of every HTTPS request before dispatch. Missing Chrome is an explicit skipped test, not browser certification.

- 42 unit/boundary tests PASS.
- Offline browser suite PASS: guest gameplay, legacy save loading, signed-in updates, cloud-only loading, cloud/device conflict choices and first-save creation compared to original main. Device save contents and save request methods/owners/payloads match main. Mocked score success and permission failure do not modify game saves or retry automatically. No live project endpoint or real account is used.
- TypeScript and production Vite build PASS. Existing >500kB bundle warning remains.
- AuthGate.tsx, auth.css and supabase/schema.sql are byte-identical to main. AST-based tests compare every existing named gameplay/save helper (including nested update/reset) against main.
- Board migration matches the deployed checksum. No migration is run by build/tests.

## Remaining risks and recommendation

GO for review/approval of this smaller release. No deployment is authorized by this report.
Main's pre-existing cloud-save limitations remain: client-clock revisions can collide, existing conflict choices replace a branch without the development branch's recovery enhancements, and existing validation is permissive. This release deliberately does not claim to repair them. No production save was inspected or used.
Scores remain explicitly unverified and client-reported; account spoofing is rejected by the deployed SQL, but this is not an anti-cheat system. Read RPC global ranking cost and per-account cooldown limitations remain.
Snapshot equality proves that the current account holds the same saved game; an extra read or simultaneous save change may require a manual retry of verification. Publishing failures never trigger a save write.
Native device testing and the exact new client against production HTTP have not been run; prior authorized production board RPC verification pertains to the existing contract, not this new branch's end-to-end UI. All new account/save tests are synthetic/offline.

After approval: review the full diff; commit and push only with explicit permission; verify preview UI/signed-out public reads without additional production score submissions; separately approve merge to main/Vercel release. Record the prior Vercel deployment for rollback. Deploy no SQL, run no bulk Supabase push, and make no auth/environment changes. Roll back only the web deployment if necessary; retain leaderboard and save data.
