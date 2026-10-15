# Billionaire Board review and deployment plan — 2026-10-15

Status: local validation PASS; production release remains gated on staging validation and owner approval. No production connection or deployment was performed.

## Repeatable local validation

Run from the repository:

```sh
npm test
npm run test:leaderboard:db
npm run test:leaderboard:stress
npm run build
```

The DB command uses Postgres.app 18 psql, hardcoded loopback port 5432 and silicon_hustle_test. It ignores .env files and inherited PostgreSQL settings/password files, does not apply migrations, verifies the installed RPC bodies against migration 202610150002, and executes fixture writes in one rolled-back transaction. SQL also guards the server address and database name. Existing players are never backdated or renamed. Before/after fingerprints compare all board fields and auth user IDs without printing them. A disconnected or failed SQL session rolls back its transaction. Temporary fixture accounts have no email addresses. Do not run concurrently with another process changing board/auth records: the preservation check intentionally detects those changes too.

Results on local PostgreSQL 18.6:

- npm test: 63/63 PASS (62 pre-existing plus one race regression).
- Database: 32 named assertion notices plus exception-based rejection cases PASS; installed RPC body parity and before/after preservation PASS.
- Build: PASS; existing Vite chunk size warning (>500 kB).
- git diff --check: PASS.
- No game save reads/writes by the integration runner. Neither migration was applied. No backup directory or .env.local access.

The local auth.users table is a minimal ID stub; auth.uid() reads request.jwt.claim.sub and authenticated lacks direct auth-schema usage. Tests use SET LOCAL ROLE and simulated request claims. They verify SQL authorization, not JWT signature checking or actual Supabase session behavior. Real Supabase has additional auth columns, grants, triggers and API layers. The runner intentionally refuses any other target; do not point it at staging/production by editing connection settings casually.

## Findings and changes

1. Fixed client race: a refresh started before a successful publication could later fail and mark that successful state as an error. The failure path now checks the same mutation generation as the success path. A deferred-read regression test exercises the failure order.
2. Repaired unsafe/unusable old integration harness: it required an empty board, assumed full auth columns, and backdated every existing board row. Tests now support this populated local database and restrict all persistent-table fixture updates to generated test users inside rollback.
3. No SQL security or correctness change was required by the tested paths; migration 202610150002 is unchanged. No migration was reapplied.

Security assessment:

- Owner derives only from auth.uid(); expected-user mismatch, missing expected ID and missing session are rejected. SQL uses no dynamic query construction.
- Both RPCs are SECURITY DEFINER, have an empty search_path and schema-qualified table/auth references. Actual installed bodies match the migration. Definer ownership must remain trusted and able to bypass board RLS for global reads/writes.
- anon cannot read the private table or execute submit; authenticated cannot INSERT/UPDATE/DELETE directly and can SELECT only its own row under RLS. Public RPC objects omit user_id/email.
- Scores reject NULL, negative, fractions, over-cap, NaN and both infinities before bigint conversion. Zero and the trillion-dollar cap are accepted. Unsupported/NULL versions and invalid/reserved names are rejected. Name normalization, personal-best monotonicity, equal-score timestamp preservation, cooldown, pagination, self outside the page and deterministic ranking are covered.
- Client-reported valuations can be forged by an authenticated account up to the cap. This is an explicit product limitation, not anti-cheat verification. Public names are user-generated; reserved names do not constitute general impersonation/moderation prevention.
- Cooldown is per account and applies to successful updates, not invalid requests or anonymous reads. The read RPC ranks/counts the whole board; its 50-entry limit does not bound database work. Require load testing and platform abuse controls before growth.
- Ranking positions are snapshots and may change between RPCs as other accounts publish. Separate-connection tests now verify ON CONFLICT lock contention for first inserts and existing-row updates. The higher concurrent score may be rejected when a lower submission wins the cooldown; retry after cooldown is required and tested.

## Additional local validation — 2026-10-15

`npm run test:leaderboard:stress` passed on PostgreSQL 18.6. This runner differs from the rollback-only suite: independent connections require **committed, newly generated fixture accounts**. It preflights auth dependencies and user triggers, refuses unexpected dependencies, commits only its fixtures, and deletes only generated fixture IDs in finally cleanup. It does not recreate the board or reapply either migration. Do not run alongside normal board/auth writes. If the process is forcibly terminated or cleanup fails, the printed temporary directory contains a fixture-ID manifest for reviewed cleanup; automatic cleanup cannot be guaranteed after SIGKILL or server failure.

Concurrent cases passed with observed blocking via pg_stat_activity/pg_blocking_pids, not timing assumptions:

- Same-user initial insert race: first 500 accepted; overlapping 900 waits then receives cooldown rejection. Only one row survives.
- Existing best 100: overlapping 900 first and 50 second retains 900; rejected second writer cannot overwrite it.
- Existing best 100: overlapping 50 first retains 100; overlapping 900 receives cooldown rejection. After a real 10-second cooldown, 900 succeeds with stable public ID and newer achievement timestamp.
- Subsequent lower-score retry preserves best, public ID and achievement timestamp.
- Anonymous reading during an uncommitted insert does not expose the new score. Deep pagination returns global ranks and omits private fields.
- Final board and auth ID fingerprints exactly match the pre-run values; all fixture rows were removed.

Load: pgbench 18.6, four concurrent clients, two worker threads, 1,000 transactions per dataset, random 50-entry pages across offsets 0–9,950. Each transaction sets the anon role and calls the public read RPC. 10,000 fixture board players plus the original records and a few concurrency fixtures were present. No game saves were read or written. The predeclared local smoke threshold was zero failed transactions and p95 below one second; this is not a production SLO.

| Dataset | Transactions | Failures | p50 | p95 | Maximum | Throughput |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Small baseline | 1,000 | 0 | 0.183 ms | 0.274 ms | 1.438 ms | 19,879 tx/s |
| +10,000 fixture players | 1,000 | 0 | 19.775 ms | 23.757 ms | 219.104 ms | 190 tx/s |

The populated run took about 5.3 seconds including connection setup. The small baseline mostly requests empty pages; it is a diagnostic reference, not an equivalent payload benchmark. Results cover a short read-only SQL load on a local Mac with warm database buffers. They exclude TLS/network, connection pooling, PostgREST, JWT verification, shared hosted resources and sustained mixed write/read traffic. The RPC still ranks/counts the board globally; a returned page of 50 does not cap its work. Future raw pgbench summaries and latency metrics are saved as results.json in the printed temporary test directory, alongside latency logs and the fixture manifest. Generated results are kept outside the repository; the reviewed metrics above are the retained validation record.

PostgreSQL 17 availability: only Postgres.app version 18 is installed (`latest` also points to 18). Standard Homebrew PostgreSQL 17, /Library/PostgreSQL/17, Docker, OrbStack and Supabase CLI locations/commands were unavailable. No installation, external image fetch or external connection was attempted. Local auth remains the minimal SQL stub; realistic GoTrue/PostgREST validation is unavailable.

## Production-specific checklist review

The local tests do not clear these release gates:

- **Migration sequencing:** a bulk Supabase push may apply the paused earlier 202610150001 file. Require an explicit single-file deployment path and reviewed migration-history reconciliation; never mark the paused file applied to bypass ordering.
- **Actual ownership and inherited grants:** inspect function/table owners, owner RLS bypass, role memberships, PUBLIC grants, default grants and overloaded signatures. Exposed schema and RPC execution must match the intended API. SECURITY DEFINER must not inherit an untrusted owner. The catalog preflight now includes owner attributes and effective role privileges.
- **Schema cache/client compatibility:** verify named RPC parameters/defaults, bigint JSON handling, cache refresh, stale-session and expired-JWT behavior through actual Supabase HTTP calls. An unsigned visitor and a Supabase anonymous-auth account have different privileges.
- **Capacity/abuse:** SQL cooldown alone does not limit anonymous reads, invalid requests or multi-account submissions. Set hosted API rate/request limits and statement timeouts from realistic hosted load results. Select a production latency target and repeat sustained and mixed load tests at expected growth volumes.
- **Deployment/rollback:** deploy database before client enablement, keep the unverified label, and verify permission revocation through fresh API requests. In-flight calls may finish after a revoke; inherited grants and any alternate RPC overload must also be addressed. Retain score data during rollback, and keep game_saves outside every change.
- **Recovery/readiness:** perform the approved production catalog/security-advisor checks and recovery drill, with explicit operator ownership. Production has not been accessed in this work. Approval for production inspection, changes and release remains separate.

## PostgreSQL 17 compatibility

Static review found no PostgreSQL 18-only syntax. JSONB aggregation/builders, numeric special-value checks, window functions, ON CONFLICT WHERE/RETURNING, row types, SECURITY DEFINER and function search_path settings are supported by PostgreSQL 17. This is documentation/static compatibility, not an executed PG17 certification.

References: [PostgreSQL 17 CREATE FUNCTION](https://www.postgresql.org/docs/17/sql-createfunction.html), [PostgreSQL 17 INSERT](https://www.postgresql.org/docs/17/sql-insert.html), [PostgreSQL 17 numeric types](https://www.postgresql.org/docs/17/datatype-numeric.html), [Supabase database functions](https://supabase.com/docs/guides/database/functions).

## Release gates (not executed)

1. Obtain approval for a disposable Supabase staging project running PostgreSQL 17 or a local full Supabase PG17 stack. Do not reuse production credentials. Apply only 202610150002 there to a fresh baseline, with normal Supabase auth roles/schema. Never apply the paused 202610150001 migration. The existing local migration must not be reapplied.
2. Port the rollback fixture suite to an explicitly staging-guarded runner after inspecting auth triggers; create staging-only auth accounts through supported Auth APIs where necessary. Verify constraints, function owners, search_path, ACLs, RLS, public field whitelist and installed definitions. Test zero/maximum scores, all rejection cases, empty board, >50 founders and offset cap.
3. Exercise Supabase JS/PostgREST end to end using anon key and two real user JWTs: anonymous read, direct-table denial, self-only table SELECT, impersonation guard, expired/tampered JWT rejection, account switch in flight, offline retry and cooldown handling. Never ship a service_role key to clients. Distinguish Supabase anonymous-auth users (authenticated role) from unsigned visitors; decide whether anonymous-auth users may join if that provider is enabled.
4. Repeat the locally passing concurrent same-account submissions in the real Supabase environment from separate connections (higher/lower scores, initial insert race, cooldown winner, higher-score retry after cooldown); assert no best regression, stable public ID and preserved timestamps on lower/equal values. Test concurrent reads, retry behavior and transient rank changes. Load-test global ranking/count cost and choose API rate/statement timeout controls.
5. With separate explicit approval, perform production read-only catalog preflight using BILLIONAIRE_BOARD_PREFLIGHT.sql. Confirm actual PG version, auth API, trusted ownership, role memberships/default grants, absence of conflicting objects/overloads and migration-history state. Review full grants with the Supabase security advisor. Do not inspect save contents. Do not execute schema.sql or a bulk migration push: both can include the paused cloud-save change.
6. Arrange an approved backup/recovery point and staging restore drill outside the prohibited existing backup directory. Confirm who owns rollback. Review migration checksum and exact target project before any write. Approval to commit/push, production migration and Vercel release are separate decisions.
7. After explicit production approval, apply ONLY 202610150002 as one transaction through an operator-reviewed path. It already has 5s lock/30s statement timeouts; stop on any error and investigate, rather than retrying against partially understood state. Reconcile migration history without marking 202610150001 applied. Reload PostgREST schema cache if needed (approved operator action), then verify grants/definitions and anonymous sanitized reads. Use an explicitly approved test account for write smoke tests; do not touch player saves.
8. Approve the application release separately. Monitor RPC latency/errors, cooldown frequency, table growth and malformed/forged-score reports. Stop rollout if private fields appear, ACL/RLS checks fail, or save operations change unexpectedly.

## Rollback considerations

- Before migration COMMIT: any error should roll back the entire transaction. Verify absence of partial objects before retrying.
- After COMMIT: prefer disabling publishing and retaining leaderboard rows. An approved operator can revoke EXECUTE on submit_billionaire_score(numeric,text,text,uuid) from PUBLIC, anon, authenticated in a transaction. If public exposure is suspect, revoke get_billionaire_board(integer,integer) too and authenticated SELECT on billionaire_board; invalidate PostgREST caches and test denial. Include any discovered inherited grants when revoking.
- Permission revocation blocks subsequent calls; already running transactions may finish. Coordinate incident handling accordingly.
- Roll back the UI release or show feature unavailable; existing client error handling preserves device peaks and saves. Permission-denied responses may display an error rather than the missing-migration message.
- Do not DROP/TRUNCATE the board, delete auth accounts, restore over the live database, or touch game_saves as feature rollback. Do not apply or revert the paused cloud-save migration. Export/retain board data only through an approved procedure.
- A later fix should be a separately reviewed forward migration. Do not rerun CREATE TABLE migration over an existing board or silently edit deployed migration history.

## Approval decisions

The owner approved committing the reviewed local fixes, tests and documentation on leaderboard-development. Approval remains required for push, creating/contacting external staging, any production access/change, backup/restore operations, Vercel release or merge to main. Product decision: accept unverified scores and account-level cooldown for early access, or require server-side verification/moderation first.
