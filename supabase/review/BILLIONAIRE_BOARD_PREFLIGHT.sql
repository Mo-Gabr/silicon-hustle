-- PREPARED ONLY. Do not execute against production without explicit approval.
-- Catalog-only review; no save data or auth user data is selected.
begin read only;
set local statement_timeout = '10s';
select current_database(), current_user, current_setting('server_version');
select c.oid::regclass as object, c.relrowsecurity, c.relforcerowsecurity,
       pg_get_userbyid(c.relowner) as owner, c.relacl
from pg_class c where c.oid=to_regclass('public.billionaire_board');
select p.oid::regprocedure as function, pg_get_userbyid(p.proowner) as owner,
       p.prosecdef, p.provolatile, p.proconfig, p.proacl, pg_get_functiondef(p.oid)
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where (n.nspname='public' and p.proname in ('get_billionaire_board','submit_billionaire_score'))
   or (n.nspname='auth' and p.proname='uid');
select * from pg_policies where schemaname='public' and tablename='billionaire_board';
select conname, pg_get_constraintdef(oid) from pg_constraint
where conrelid=to_regclass('public.billionaire_board');
select indexdef from pg_indexes where schemaname='public' and tablename='billionaire_board';
select rolname, rolsuper, rolbypassrls, rolcanlogin from pg_roles
where rolname in ('anon','authenticated','authenticator','service_role');
select member::regrole as member, roleid::regrole as granted_role from pg_auth_members
where member in (select oid from pg_roles where rolname in ('anon','authenticated','authenticator'));
-- Inspect effective client privileges, including grants inherited through roles.
select r.role_name, p.oid::regprocedure as function,
       has_function_privilege(r.role_name,p.oid,'EXECUTE') as may_execute
from (values ('anon'),('authenticated')) r(role_name)
cross join pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in ('get_billionaire_board','submit_billionaire_score');
select r.role_name, privilege,
       case when to_regclass('public.billionaire_board') is not null then
         has_table_privilege(r.role_name,to_regclass('public.billionaire_board'),privilege)
       end as allowed
from (values ('anon'),('authenticated')) r(role_name)
cross join (values ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE')) v(privilege);
select p.oid::regprocedure, owner.rolname, owner.rolsuper, owner.rolbypassrls,
       owner.rolcanlogin
from pg_proc p join pg_roles owner on owner.oid=p.proowner
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in ('get_billionaire_board','submit_billionaire_score');
select nspname, nspacl from pg_namespace where nspname in ('public','auth');
select defaclrole::regrole, defaclnamespace::regnamespace, defaclobjtype, defaclacl
from pg_default_acl;
-- Prior to first deployment, leaderboard objects should be absent; after, inspect
-- every overload and actual effective privileges. This file applies no migration.
rollback;
