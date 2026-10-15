# THE BILLIONAIRE BOARD

## What is implemented

A separate leaderboard screen for web and Capacitor iOS. MOGABR's $74,600,000,000 FOUNDER'S BENCHMARK / LEGEND is a permanent UI-only developer card above the rankings. It is not inserted as a player, does not affect positions, and is explicitly distinguished from every unverified player score. No sample player scores are shipped.

Global pages show 50 real database records, plus the signed-in player's globally ranked personal best even outside that page. Ordering is highest valuation, earliest achievement of that best, then stable opaque public ID. Milestones are $100M, $1B, $10B, and $74.6B. The current game ends after 30 months; the benchmark is aspirational and does not change the game's valuation formula or win target.

Players explicitly join with a public founder name before automatic publishing begins. Names are 3–24 ASCII letters/numbers/spaces/dots/hyphens/underscores; emails, markup, and normalized developer/admin names are rejected. Names are editable and need not be unique. Public responses omit auth user IDs and emails; they return an opaque public UUID. Identity/ownership user IDs remain in the private table.

## Scores and persistence

The app observes the existing valuation formula after each successful local game action, rather than waiting for the final month. Existing monthly report valuations seed recoverable historical peaks. Unrecorded intermediate peaks from before this feature existed cannot be reconstructed. Per-account pending peaks live outside game saves in `silicon-hustle-board-v1:<user_id>` and survive new games/app updates that preserve device storage. Published personal bests live in Supabase and survive device switches. Clearing device storage can lose an unpublished peak; already-published bests remain on the server.

The leaderboard reads the local save-owner marker before associating gameplay with an account. Snapshot matching prevents an old in-memory game from being attributed to an account whose different cloud game is being loaded. This is a read-only check; AuthGate, saveSync, authentication configuration, and the cloud-save revision migration are unchanged. An unresolved cross-account save is not automatically published.

Score writes use only the authenticated user's `auth.uid()`; clients cannot choose another owner, achievement timestamp, rank, or verification flag. An expected-account ID is passed only as a guard: the RPC rejects it unless it matches auth.uid(), preventing a queued score from crossing accounts if the SDK obtains a token after an account switch. Direct client INSERT/UPDATE/DELETE are revoked, RLS allows private reads only for the record owner, and a narrowly scoped SECURITY DEFINER RPC performs atomic `INSERT ... ON CONFLICT DO UPDATE` with `greatest(existing_best, submitted_score)`. Lower scores, replayed submissions, new games, and name changes cannot decrease an accepted server best. Game version and achievement timestamp change only on a strict improvement; achievement time is server receipt time, not a trusted offline event time.

Pending peaks retry periodically while active, on reconnect/focus, and on native resume. Leaderboard errors do not stop trading, alter saved games, or sign anyone out. Missing RPCs produce an explicit backend-not-enabled message, not fake rankings.

## Independent database migration — NOT APPLIED

`supabase/migrations/202610150002_billionaire_board.sql`

This creates only the leaderboard table, index, policies and two RPCs, and depends on standard Supabase Auth roles/users/functions. It does not reference `game_saves`, use its revision guard, or change its policies. **Do not run a blanket `supabase db push`: that could apply the paused `202610150001_save_revision_guard.sql`.** After approval, apply only the reviewed leaderboard migration through a selective, tracked release workflow (or the explicitly reviewed standalone SQL), and reconcile migration history without applying the paused file. Do not run schema resets or the full schema.sql.

Accepted game version starts at `0.9.0`. Before releasing a future version, add that version to the SQL constraint/RPC whitelist through a new migration, then release clients. Backward-compatible versions should remain accepted. The score ceiling is $1 trillion, a sanity bound rather than proof of valid gameplay. Whole-dollar scores must be finite and nonnegative. SQL restricts accepted profile/score writes to once per 10 seconds per account using the atomic upsert condition; simultaneous first submissions are covered by the user primary key. The app retries higher pending peaks later. Reads are page-bounded, but the ranking scan still needs performance testing at scale.

## Verification

- `npm test`: existing save regression suite plus leaderboard unit/controller tests covering ordering, peak persistence, new games, another-device higher best, renames, cooldown, offline errors, account separation, public field filtering and permission-error handling. SQL text assertions check intended privilege/RPC configuration; these are not real RLS execution tests.
- `npm run build`: full TypeScript/Vite production build.
- `supabase/tests/billionaire_board.sql`: automated real SQL assertions for permissions/RLS, authenticated ownership, atomic max semantics, achievement preservation, cooldown, invalid values/names, public-field privacy, ranking and pagination. Requires an **empty isolated Supabase database**, the leaderboard migration, an administrator test session, `ON_ERROR_STOP`, and explicit `SET silicon_hustle.test_database = 'isolated'`. Fixtures roll back. Never run it in production.
- PostgreSQL/Docker/Supabase CLI are absent on this machine; real SQL tests have **not been run**. Do not infer database/RLS correctness from JavaScript or mock HTTP tests.

A real concurrent-connection staging test must also race two submissions for one user, check one accepts/the other is rate-limited, retry the higher score after cooldown, and confirm the final best is the maximum. Test an old pending lower score after a newer device submission. No time-based client test substitutes for PostgreSQL concurrency.

## Before real global scores can appear

1. Review the standalone SQL against the actual Supabase project, including grants and function ownership. Test the exact migration and SQL suite in an isolated/staging Supabase environment; exercise true concurrent clients and inspect public RPC fields.
2. After approval, back up the target project and apply **only the leaderboard migration**, leaving the cloud-save migration paused. Confirm the two RPCs are exposed by PostgREST and anon/authenticated execute grants match the file. Do not grant direct table writes.
3. After separate release approval, deploy the updated web build and build/sync/install the updated iOS app using its existing bundle ID. Keep existing Supabase URL/anon key and auth providers. No new service-role secret belongs in the client.
4. A player signs in through the existing Account flow, resolves any existing save conflict, saves/continues a game, then chooses a public name and joins the board. The real recorded peak is submitted; existing game_saves records are not silently bulk-imported. Once joined, future peaks publish automatically.
5. Test on physical iPhone: sign-in/deep links, public name keyboard (16px input), offline peak/reconnect, background/force-quit/resume, switching between iPhone/web, new-game best retention and updating over the installed app. Confirm another account cannot receive the prior account's pending peak.

## Unverified scores and authoritative anti-cheat

All initial scores are labelled UNVERIFIED, in the schema and UI. Authentication proves account ownership, not truthful valuation. Bounds, version checks, reserved names, atomic monotonic writes and per-account write throttling deter malformed/simple spam; a modified client can still submit plausible fake scores, edit its local cache, or create multiple accounts. The PostgreSQL write cooldown does not prevent flooding rejected requests or anonymous reads. Before a public launch, add API/WAF/global/IP quotas as needed and abuse/name moderation; avoid claiming authoritative verification.

Authoritative scores require a server-owned game session/seed, authenticated versioned action log with sequence/idempotency checks, server-side simulation of trades/prices/lab upgrades and valuation, server-generated achievements, replay auditing, session/account abuse detection and moderation. Clients must submit actions rather than arbitrary accepted valuations. Verified scores should have a separate server-only status/ranking lane; never promote these initial self-reported records automatically. Avoid trusting game_saves or signed client blobs as proof without authoritative replay.

References: [Supabase function security](https://supabase.com/docs/guides/database/functions), [PostgreSQL atomic upserts](https://www.postgresql.org/docs/current/sql-insert.html).

## Latest local validation — October 15, 2026

- PASS: 62 application regression/unit/controller tests; production TypeScript/Vite build; diff whitespace check.
- PASS: local Chrome tests at 320, 375, 390, 430, 650, 651 and 1280px with no horizontal overflow, plus join/edit name, actual Lab upgrade valuation capture, new-game/reload best retention, email omission, account-bound RPC parameters, and missing-backend gameplay. Supabase traffic was fully intercepted; test player fixtures are not shipped.
- NOT RUN: real SQL/RLS/concurrent-connection tests (PostgreSQL/Docker/Supabase CLI unavailable). The existing bundle-size warning remains.
- Confirmed by SHA-256 comparison: src/AuthGate.tsx, src/saveSync.ts and paused 202610150001_save_revision_guard.sql are unchanged by leaderboard work. No real save was reset and no live SQL, commit, push or deployment occurred.
