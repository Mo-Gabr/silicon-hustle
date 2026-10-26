# Rankings: release review

> **Historical architecture record — not current setup instructions.** This document records the former live Rankings release, including cloud-save-based attribution. References below to cloud synchronization, live Rankings, branches, commits and validation status describe that earlier work. The current client uses account-isolated local games and fictional Rankings without score publishing. Use [README.md](README.md), [AUTH_SETUP.md](AUTH_SETUP.md) and [IOS_SETUP.md](IOS_SETUP.md) for current behavior and setup.

Base: GitHub main `62aa1706d2f5bfb97b56483fda4c1cf0d656f53d` (verified read-only).
Local release branch: `leaderboard-release`. The original release is commit `c94610d`; the Preview diagnostics/naming fixes are uncommitted for review.
`main` and `leaderboard-development` refs are unchanged.

## Release behavior

- Adds the Rankings tab, real public rankings, own best/rank, developer benchmark, milestones and public-name controls.
- Publishing is manual for both first joins and later score/name updates. There is no background publisher, automatic submit on login, timer or reconnect retry.
- Each manual publication verifies the authenticated identity, reads that account's own cloud save through the existing Data API, compares the full JSON snapshot with the currently displayed and locally persisted game, and checks identity/game again. Account switching, guest/anonymous-auth sessions, unsynced games, missing cloud saves and conflicting snapshots block publication.
- The SQL expected-user-ID argument binds the final write to the verified account even if the SDK token changes afterwards.
- Publishes the rounded current valuation or higher recorded report valuation in the verified saved snapshot. Previously verified account peaks and server bests are preserved in a separate board-only cache. Never attributes an unverified observation to the current account.
- Temporary offline/intermediate peaks that were never verified or recorded in saved reports are not carried over from the full development implementation. A game must first sync through main's existing save flow. A player may need to resolve the existing Account save choice, wait for sync, then click publish again.
- Additional per-publication save reads are read-only and introduce no new save synchronization or recovery behavior.

## Exact inventory versus main (15 files)

| File | Change |
| --- | --- |
| index.html | Browser tab title Silicon Hustle and branded PNG favicon link |
| public/silicon-hustle-icon.png | Unmodified copy of the existing iOS app icon for browser branding |
| package.json | Adds test and test:browser scripts; dependencies/build unchanged |
| src/main.tsx | Adds board import/provider/tab and a read-only state observation effect; existing loader, actions, save persistence, valuation and reset functions unchanged |
| src/BillionaireBoard.tsx | Board UI/auth subscription/read RPC/manual publish integration; read-only account-save attribution |
| src/rankingsApi.ts | Configuration guard and sanitized Rankings error classification |
| src/boardAttribution.ts | Canonical snapshot equality and fresh identity/ownership checks; no storage or database writes |
| src/leaderboardCore.ts | Public response handling, ranking, naming, cooldown, isolated account peak cache and controller |
| src/leaderboard.css | Board-scoped styles only |
| supabase/migrations/202610150002_billionaire_board.sql | Exact previously deployed SQL retained for history; DO NOT RUN AGAIN |
| tests/rankings-config.test.mjs | Missing-variable, RPC-error, privacy and shared naming regressions |
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

- 49 unit/boundary tests PASS.
- Offline browser suite PASS: guest gameplay, legacy save loading, signed-in updates, cloud-only loading, cloud/device conflict choices and first-save creation compared to original main. Device save contents and save request methods/owners/payloads match main. Mocked score success and permission failure do not modify game saves or retry automatically. No live project endpoint or real account is used.
- TypeScript and production Vite build PASS. Existing >500kB bundle warning remains.
- AuthGate.tsx, auth.css and supabase/schema.sql are byte-identical to main. AST-based tests compare every existing named gameplay/save helper (including nested update/reset) against main.
- Board migration matches the deployed checksum. No migration is run by build/tests.

## Remaining risks and recommendation

Local fix is ready for review; NO-GO for further release action until the Preview configuration/error is verified. No deployment is authorized by this report.
Main's pre-existing cloud-save limitations remain: client-clock revisions can collide, existing conflict choices replace a branch without the development branch's recovery enhancements, and existing validation is permissive. This release deliberately does not claim to repair them. No production save was inspected or used.
Scores remain explicitly unverified and client-reported; account spoofing is rejected by the deployed SQL, but this is not an anti-cheat system. Read RPC global ranking cost and per-account cooldown limitations remain.
Snapshot equality proves that the current account holds the same saved game; an extra read or simultaneous save change may require a manual retry of verification. Publishing failures never trigger a save write.
Native device testing and the exact new client against production HTTP have not been run; prior authorized production board RPC verification pertains to the existing contract, not this new branch's end-to-end UI. All new account/save tests are synthetic/offline.

After approval: review the full diff; commit and push only with explicit permission; verify preview UI/signed-out public reads without additional production score submissions; separately approve merge to main/Vercel release. Record the prior Vercel deployment for rollback. Deploy no SQL, run no bulk Supabase push, and make no auth/environment changes. Roll back only the web deployment if necessary; retain leaderboard and save data.

## Preview failure diagnosis and Rankings naming

Confirmed source bug: when either public Supabase build variable was absent, AuthGate exported a null client. The board adapter fabricated code PGRST202 without sending a request; the controller then incorrectly implied that the database feature was not installed. Genuine missing-RPC/schema codes used the same message. Successful Production variables or successful direct RPC tests do not establish Preview configuration.

Read-only evidence: the exact c94610d Preview URL redirects to Vercel Login. Deployment/environment metadata requests returned 404. No Vercel CLI is installed. Automatic approval review rejected the protected-deployment fetch because that tool may create/reuse an authentication-bypass link; it was not used to bypass protection. No variable scopes or values were retrieved, no production Supabase request was made and no settings were changed. The actual Preview cause (missing variables, branch override/wrong project, or actual RPC/schema-cache failure) remains unconfirmed. Do not describe missing Preview variables as a proven fact without further evidence.

Local changes distinguish configuration failure from actual RPC, permission and network failures. Raw backend error messages are not rendered, avoiding credential/private-detail reflection. No public-config fallback or project override is introduced. RPC identifiers/signatures are unchanged. Configuration readiness diagnostics contain names/booleans only.

All feature labels use Rankings, including navigation, heading, accessible refresh label, join action, empty states and failure messages. Internal component/CSS/database/RPC identifiers remain stable. Capacitor uses the same dist web assets; no native artifacts were generated and no installed iOS build was released.

The offline browser suite additionally builds variants missing URL, missing key or both, proving that these show the configuration message and send zero RPC requests. A real mocked PGRST202 response shows a distinct message and does not echo raw backend details. Gameplay/cloud-save parity with main remains covered.

To unblock: inspect Preview scopes and leaderboard-release overrides for VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY using authorized Vercel access; verify the selected project without sharing values. In the Preview browser, distinguish no RPC request from a real request's sanitized HTTP status/error code. Any environment correction, new commit/push or Preview rebuild requires separate authorization. Do not rerun the already-applied migration.

## Web branding cleanup

Browser title is Silicon Hustle, without a version suffix. The favicon is an unmodified copy of the existing iOS AppIcon.png served at /silicon-hustle-icon.png. The existing in-game version display is unchanged. No gameplay, saves or authentication code changed for this cleanup.

Production Vite build passed; built HTML and a fresh local browser verified the title/favicon reference, and the favicon returned HTTP 200 image/png with bytes matching the existing icon. Application scripts and external connections were blocked for this metadata check. Live Vercel Preview verification remains pending: these changes are uncommitted/unpublished and the existing Preview is protected. No push or deployment was performed.

## Continued Preview investigation after environment reassignment

GitHub reports a successful redeploy at 2026-10-16T17:48:08Z to silicon-hustle-d7led6ct6-moronta.vercel.app, still at c94610d. That commit does not contain these uncommitted diagnostics, naming or title/icon changes. User reports both public variable names now assigned to Preview and Production; those scopes are not treated as evidence of actual compiled values.

The new URL still redirects an unauthenticated read to Vercel Login. Deployment-details inspection through the available connector returned 404, even with the team ID independently confirmed. The deployed bundle and browser request therefore remain unobserved. No protection-bypass path was retried or created.

Authorized anonymous production read diagnostics using only known public configuration: GET get_billionaire_board returned HTTP200/no error; POST with the app's exact named arguments also returned HTTP200/no error. A third POST was parsed by the exact committed c94610d boardPage implementation and passed, with no private fields. No authentication session, user account, score submission or game-save endpoint was used. This rules out a general GET-versus-POST or public response-parser incompatibility against the known project. It does not prove what project/configuration the protected Preview actually uses.

Added a browser regression for a configured anonymous client receiving populated public Rankings, plus a configuration-guard/RPC-contract regression. Existing missing-variable, service-error, naming and baseline save-parity coverage is preserved. Root cause of the misleading message is confirmed in c94610d; the specific deployed trigger remains unconfirmed pending sanitized browser request evidence or authorized read-only deployment visibility. Do not rerun migrations, assume missing variables, change settings or deploy based on this partial diagnosis.
