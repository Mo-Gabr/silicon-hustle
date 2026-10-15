-- READ ONLY. Run with an authorized database administrator in the intended
-- production project. No migration, save modification, or auth change occurs.
-- These results inspect configuration; they do not prove RLS enforcement.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '3s';

SELECT current_database() AS database_name,
       current_user AS inspecting_role,
       current_setting('server_version') AS postgres_version,
       current_setting('transaction_read_only') AS read_only;

SELECT to_regclass('public.game_saves') AS save_table,
       to_regclass('auth.users') AS auth_users_table,
       to_regprocedure('auth.uid()') AS auth_uid_function,
       to_regclass('supabase_migrations.schema_migrations') AS migration_history;

-- Required: user_id uuid PK/FK; game_state jsonb NOT NULL;
-- updated_at timestamp with time zone, precision 6, NOT NULL, default now().
SELECT ordinal_position, column_name, data_type, udt_name, is_nullable,
       column_default, datetime_precision, is_generated
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'game_saves'
ORDER BY ordinal_position;

SELECT c.relkind, pg_get_userbyid(c.relowner) AS table_owner,
       c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced
FROM pg_class c
WHERE c.oid = to_regclass('public.game_saves');

SELECT conname, contype, convalidated,
       pg_get_constraintdef(oid, true) AS definition
FROM pg_constraint
WHERE conrelid = to_regclass('public.game_saves')
ORDER BY conname;

SELECT policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'game_saves'
ORDER BY policyname;

-- Includes grants to PUBLIC, which role_table_grants alone omits.
SELECT CASE WHEN a.grantee = 0 THEN 'PUBLIC'
            ELSE pg_get_userbyid(a.grantee) END AS grantee,
       pg_get_userbyid(a.grantor) AS grantor,
       a.privilege_type, a.is_grantable
FROM pg_class c
CROSS JOIN LATERAL aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
WHERE c.oid = to_regclass('public.game_saves')
ORDER BY grantee, privilege_type;

SELECT grantee, column_name, privilege_type, is_grantable
FROM information_schema.column_privileges
WHERE table_schema = 'public' AND table_name = 'game_saves'
ORDER BY grantee, column_name, privilege_type;

SELECT rolname, rolsuper, rolbypassrls, rolcanlogin
FROM pg_roles
WHERE rolname IN ('anon', 'authenticated', 'service_role')
ORDER BY rolname;

-- Include indirect membership, not just direct grants. Review role-membership
-- options and effective privileges for the actual PostgreSQL version as well.
WITH RECURSIVE reachable_roles AS (
 SELECT oid AS root_oid, oid AS role_oid
 FROM pg_roles WHERE rolname IN ('anon', 'authenticated', 'service_role')
 UNION
 SELECT r.root_oid, m.roleid
 FROM reachable_roles r JOIN pg_auth_members m ON m.member = r.role_oid
)
SELECT member_role.rolname AS member_role, parent_role.rolname AS reachable_role,
       parent_role.rolsuper, parent_role.rolbypassrls
FROM reachable_roles r
JOIN pg_roles member_role ON member_role.oid = r.root_oid
JOIN pg_roles parent_role ON parent_role.oid = r.role_oid
ORDER BY member_role, reachable_role;

-- Review every trigger, including its enabled state and execution order.
SELECT t.tgname, t.tgisinternal, t.tgenabled,
       pg_get_triggerdef(t.oid, true) AS trigger_definition,
       t.tgfoid::regprocedure AS trigger_function
FROM pg_trigger t
WHERE t.tgrelid = to_regclass('public.game_saves')
ORDER BY t.tgname;

SELECT DISTINCT t.tgfoid::regprocedure AS trigger_function,
       p.prosecdef AS security_definer, p.proconfig AS function_settings,
       pg_get_functiondef(t.tgfoid) AS function_definition
FROM pg_trigger t
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE t.tgrelid = to_regclass('public.game_saves') AND NOT t.tgisinternal;

-- Detect name collisions and other tables using a same-named function.
SELECT p.oid::regprocedure AS function_name, p.prosecdef AS security_definer,
       p.proconfig AS function_settings, p.proacl AS function_acl,
       pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'game_saves_revision_guard';

SELECT t.tgrelid::regclass AS dependent_table, t.tgname,
       t.tgfoid::regprocedure AS function_name
FROM pg_trigger t
JOIN pg_proc p ON p.oid = t.tgfoid
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'game_saves_revision_guard'
ORDER BY t.tgrelid::regclass::text, t.tgname;

-- Any pending table locks/long transactions need review before DDL.
SELECT l.mode, l.granted, count(*) AS lock_count
FROM pg_locks l
WHERE l.relation = to_regclass('public.game_saves')
GROUP BY l.mode, l.granted
ORDER BY l.mode, l.granted;

COMMIT;

-- If the migration_history query above returned a table, inspect its columns,
-- then run separately (still read-only):
-- SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version;
