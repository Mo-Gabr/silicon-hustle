# Cloud save revision guard: validation and production rollout

## Current decision

**NO-GO for database sign-off and production rollout.** The migration has received static review, but it has not been executed against a real PostgreSQL/Supabase database. No production data, schema, authentication providers, or migration history were changed.

### Local tooling inspection — October 15, 2026

The following executables were not found on PATH or in the checked Homebrew/bundled runtime locations:

- Docker (`docker`, `dockerd`) or Podman (`podman`); Docker Desktop, OrbStack, and Podman Desktop were not found in Applications.
- Supabase CLI (`supabase`).
- PostgreSQL server/init/control/client (`postgres`, `initdb`, `pg_ctl`, `psql`).
- PostgreSQL backup client (`pg_dump`).

Homebrew is present; no PostgreSQL formula was found in its installed packages. Postgres.app and standard standalone PostgreSQL installation directories were also absent. No tools were installed and no test database was created.

For direct local database tests, install PostgreSQL server and command-line tools (`postgres`, `initdb`, `pg_ctl`, `psql`; `pg_dump` for backups), ideally the production major version. Docker and Supabase CLI are not required for that path. For a complete local Supabase stack, install/start a supported Docker-compatible runtime and install Supabase CLI instead. Do not interpret package installation tools or mock JavaScript tests as an available database.

## Changes prepared

The exact migration `supabase/migrations/202610150001_save_revision_guard.sql` now includes, inside its transaction:

```sql
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
```

The matching new-install trigger section in `supabase/schema.sql` uses the same settings. These apply only to the migration transaction, not future save requests. A lock timeout aborts the migration rather than leaving a partial trigger replacement; the deployment runner must stop on SQL errors and roll back a failed transaction. The 30-second timeout is per statement, not a total deployment deadline.

The migration adds a function and BEFORE INSERT/UPDATE trigger. It does not backfill, reset, delete, or rewrite existing rows. It uses existing `updated_at` values as revision tokens, not a separate revision column or historical record of game states. Stale-write rejection depends on the client's exact `WHERE user_id = ... AND updated_at = ...` filter. An unconditional update is not made safe by this trigger alone.

## Real database tests still required — NOT RUN

Use only a freshly created disposable database/cluster; no production connection strings or live saves. Match the production PostgreSQL major version. A vanilla PostgreSQL fixture needs Supabase's `auth.users`, `auth.uid()`, `anon` and `authenticated` roles and relevant grants represented accurately; full HTTP/JWT integration requires a local/staging Supabase stack.

1. **Seed before the guard exists.** Install the repository table/constraints/RLS policies without the guard section first, then add synthetic auth users and representative complete game JSON: early game, hardware holdings, Lab upgrades, reports, active crisis, and completed game. Include a default-created timestamp, an explicit older timestamp, microsecond precision, and a future-but-finite timestamp. These records do not need a separate revision field. Never use real player payloads.
2. **Record preservation baseline.** Capture row count and every `(user_id, game_state, updated_at)` plus constraints, policies, grants, and trigger definitions. Execute the exact migration file with error-stop enabled. Assert all existing rows and all three values remain identical, and that policies/grants did not change.
3. **Insert behavior.** As authenticated user A, insert an own-user save, including a deliberately stale client timestamp. Assert the returned `updated_at` is finite and server-assigned, and the payload is unchanged.
4. **Ordering.** Update a record rapidly, including within one transaction and after a future-but-finite prior timestamp. Assert each returned timestamp is strictly greater than the previous one and payload changes are only those requested. Retain the full timestamp string for comparisons; do not truncate through JavaScript Date serialization.
5. **Stale write.** Read revision R. Update with `WHERE user_id=A AND updated_at=R`, obtaining R2. Repeat a different write with R. Assert zero returned/affected rows, no payload replacement, and R2 retained.
6. **Actual concurrency.** Two independent connections both read R. Connection 1 conditionally updates and holds its transaction open. Start connection 2's conditional update with R while connection 1 holds the row lock, then commit connection 1. Assert connection 2 returns zero rows after the wait and only the winner's payload exists. Repeat with reversed order. Sequential calls alone do not validate this case.
7. **RLS isolation with non-owner roles.** Set role `authenticated` and use distinct JWT subject claims for users A/B. Assert A can read/write A; B cannot read or update A, insert as A, or change B's `user_id` to A. Assert anon cannot read/insert/update saves. Use real SQL role/JWT context; testing as a superuser or the table owner does not prove RLS. Check both existing and new records after migration. Test HTTP/JWT behavior separately in Supabase.
8. **Lock timeout and atomicity.** In one connection hold a conflicting table lock. Apply the exact migration in another connection. Assert failure near the 5-second lock timeout, transaction rollback, unchanged saves, and preservation of the prior trigger definition. Release the lock and rerun successfully. Confirm settings revert after commit/rollback.
9. **Mixed clients and idempotence.** Test the old and new client save request shapes against the trigger, including returned microsecond timestamps. Rerun the migration in the disposable database; verify one enabled guard trigger, intact rows, and unchanged RLS. Test rollback of just the guard in this environment.

No database test above is satisfied by the existing isolated-storage/mock-cloud regression suite.

## Read-only production inspection — prepared, NOT RUN

1. Confirm the intended project identity in Supabase before opening its SQL editor/administrator connection.
2. Run `supabase/review/production_schema_preflight.sql`. It uses an explicit read-only transaction. Inspect columns/precision/defaults, PK/FK, RLS, policies, effective grant sources including PUBLIC, role bypass flags, existing triggers/functions and their dependencies, and current table locks. Missing expected objects or insufficient inspection privileges block sign-off.
3. If column types match, run `supabase/review/production_save_data_preflight.sql`. It returns aggregate save health, orphan counts, and per-row payload fingerprints/timestamps without returning gameplay contents. It is not a backup. A timeout or RLS-filtered partial result is not a passing result; arrange an authorized inspection rather than loosening production permissions.
4. Required checks: `updated_at` is timestamptz with microsecond precision, NOT NULL, ordinary writable column; revisions are finite; every save has a valid owner and non-null payload; `user_id` is the PK/FK; RLS enabled; owner SELECT/INSERT/UPDATE policies intact; anon/authenticated cannot bypass RLS through privileges/memberships; no conflicting trigger/function name or timestamp-writer trigger. Future timestamps require review, not automatic repair.
5. Inspect existing migration history and reconcile it with repository files. This repository has no initial table-creation migration in the migrations folder; an empty local migration replay cannot create the base schema by running the guard alone. Baseline the existing schema with the chosen migration workflow before pushing. Do not blindly run `db push`, migration repair, or `schema.sql` against production.

## Production backup checklist — NOT PERFORMED

- [ ] Confirm project ID, database name, PostgreSQL version, operator, deployment window, and migration-history baseline.
- [ ] Confirm the latest successful Supabase database backup and available restore/PITR options for this actual project/plan. Record backup timestamp, retention, restore destination, and recovery point. Do not assume PITR or downloadable backups are enabled.
- [ ] If a logical export is required, use an approved administrator connection and `pg_dump` or the documented Supabase backup workflow. Avoid putting passwords in shell history; store backup files securely outside Git.
- [ ] Include table definition, full `game_saves` rows (`user_id`, `game_state`, `updated_at`), constraints, grants, RLS policies, trigger/function definitions, and migration history. A table-only dump is a supplemental save export, not a complete Supabase/Auth recovery strategy.
- [ ] Restore the backup into an isolated environment and check auth-user references, save counts/payloads, and permissions. Confirm required roles and extensions are present.
- [ ] Coordinate a quiet period for pre/post fingerprints if exact production row equality is required. Normal player saves during deployment legitimately change timestamps/payloads.
- [ ] Keep recovery steps scoped: removing a new guard is different from restoring an entire database, which can discard legitimate post-backup saves. Never restore production without a separate explicit decision.

## Rollout order and gates — requires approval

1. Complete real local database tests and production read-only inspection, resolve discrepancies, and approve the backup/restore plan. Until then: **NO-GO**.
2. Test the exact old/new web and iOS request shapes in staging, including timestamp precision and two-device conflict choices. Confirm the shipped client versions, not only repository source.
3. After explicit approval, deploy **only** the reviewed guard migration through the reconciled migration workflow, with an administrator and error-stop enabled. Do not rerun full `schema.sql`, seed data, or any reset operation. Deploy during the agreed low-traffic window; timeout means stop and investigate/retry later, not increase timeouts automatically.
4. Verify one enabled trigger and correct function/settings, unchanged RLS/grants, no unexpected payload changes, and no increase in save errors. Use designated test accounts for save/RLS smoke checks after approval; read-only inspection cannot prove runtime enforcement by itself.
5. Release the updated **web app**, then the updated **iOS app**. This is the recommended order, not a hard requirement for simultaneous release: the new client supports the old table, and reviewed legacy clients retain returned revision strings. Keep compatibility with older installed iOS apps.
6. Physical-device checks: Google and email callbacks, offline actions followed by reconnect, conflicting web/iPhone branches, background/resume, force-quit/relaunch, sign-out during a pending write, and development-build update over the installed app without uninstalling or clearing storage.
7. If a client rollout fails, roll back that client while retaining the guard if mixed-version tests have passed. If the trigger itself breaks saving, stop the rollout and review a targeted rollback. On a previously absent guard, dropping just this trigger restores client-managed timestamps; it weakens protection but does not reset saves. If a pre-existing function/trigger was replaced, restore its captured definition instead. No rollback is preauthorized.

## Evidence and sources

- Repository inspection and tooling detection; no live database connection used.
- Application regression/build results are recorded separately in `supabase/review/LOCAL_VALIDATION_RESULT.md`.
- [PostgreSQL timeouts](https://www.postgresql.org/docs/current/runtime-config-client.html)
- [PostgreSQL trigger behavior](https://www.postgresql.org/docs/current/sql-createtrigger.html)
- [Supabase backup and restore options](https://supabase.com/docs/guides/platform/backups)
- [Supabase database migrations](https://supabase.com/docs/guides/deployment/database-migrations)
