# Local validation result — October 15, 2026

**Database validation: NO-GO (blocked / not executed).**

No PostgreSQL or Supabase test environment could be started using available tools. Required executables `postgres`, `initdb`, `pg_ctl`, `psql`, `pg_dump`, `supabase`, `docker`, `dockerd`, and `podman` were not found. Docker Desktop, OrbStack, Podman Desktop, Postgres.app, Homebrew PostgreSQL packages, and standard standalone PostgreSQL directories were not found in the locations checked. Homebrew itself is installed. No tooling was installed, no database was created, and no existing database was contacted.

| Check | Result |
| --- | --- |
| Migration contains 5s lock_timeout and 30s statement_timeout inside BEGIN/COMMIT | Confirmed by file inspection; settings also match schema.sql |
| Exact migration executed against PostgreSQL | NOT RUN |
| Preservation of representative pre-existing rows in a real database | NOT RUN |
| Stale-write rejection in PostgreSQL | NOT RUN |
| Concurrent updates using independent database connections | NOT RUN |
| Revision ordering and full timestamp precision in PostgreSQL | NOT RUN |
| RLS enforcement using non-owner roles and distinct user claims | NOT RUN |
| Lock-timeout rollback/atomicity in PostgreSQL | NOT RUN |
| npm test | PASS: 33 tests, 0 failures |
| npm run build | PASS: TypeScript and Vite; existing >500 kB chunk warning |
| git diff --check | PASS |
| Actual production schema/save-health queries | Prepared, NOT RUN |
| Production backup/restore drill | Checklist prepared, NOT PERFORMED |

The npm suite tests application synchronization using isolated storage and a fake cloud adapter. It is not evidence that PostgreSQL triggers, locks, concurrency, or RLS work. No new simulated database test is offered as a substitute.

## To unblock

Choose one actual runtime path: (a) PostgreSQL server plus initdb/pg_ctl/psql tools, or (b) Docker-compatible runtime plus Supabase CLI for the full stack. Use a production-compatible PostgreSQL major version. Then execute the real database test matrix in CLOUD_SAVE_ROLLOUT.md in a freshly created disposable environment.

Production remains NO-GO until those tests, actual production schema/RLS/trigger inspection, backup restore verification, and mixed-version client tests pass. Production approval is a separate step.

## Prepared artifacts

- ../migrations/202610150001_save_revision_guard.sql — exact reviewed migration with transaction-local timeouts.
- production_schema_preflight.sql — configuration/permissions/trigger inspection in a read-only transaction.
- production_save_data_preflight.sql — aggregate save health and fingerprints, also read-only; run only after types are verified.
- CLOUD_SAVE_ROLLOUT.md — real-database test matrix, backup/restore checklist, rollout gates, order, and rollback considerations.

No production changes, save resets, commits, pushes, or deployments occurred. Existing application and native project changes were preserved.
