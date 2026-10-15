-- READ ONLY. Run ONLY after production_schema_preflight.sql confirms the three
-- expected columns and their types. Administrator access is needed for all rows;
-- an ordinary player's RLS-filtered count cannot validate every existing save.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '3s';

SELECT count(*) AS saved_games,
       count(*) FILTER (WHERE user_id IS NULL) AS missing_owners,
       count(DISTINCT user_id) AS distinct_owners,
       count(*) FILTER (WHERE game_state IS NULL) AS missing_payloads,
       count(*) FILTER (WHERE jsonb_typeof(game_state) IS DISTINCT FROM 'object') AS non_object_payloads,
       count(*) FILTER (WHERE updated_at IS NULL) AS missing_revisions,
       count(*) FILTER (WHERE updated_at IS NOT NULL AND NOT isfinite(updated_at)) AS non_finite_revisions,
       count(*) FILTER (WHERE isfinite(updated_at) AND updated_at > now() + interval '5 minutes') AS future_dated_revisions,
       min(updated_at) FILTER (WHERE isfinite(updated_at)) AS earliest_revision,
       max(updated_at) FILTER (WHERE isfinite(updated_at)) AS latest_revision
FROM public.game_saves;

SELECT count(*) AS orphaned_owners
FROM public.game_saves s
LEFT JOIN auth.users u ON u.id = s.user_id
WHERE u.id IS NULL;

-- Per-record fingerprints avoid returning saved game contents. Export results
-- securely for comparison; this is an integrity aid, not a recoverable backup.
-- Compare within a coordinated quiet window: legitimate saves alter fingerprints.
SELECT user_id, md5(game_state::text) AS payload_fingerprint, updated_at
FROM public.game_saves
ORDER BY user_id;

COMMIT;
