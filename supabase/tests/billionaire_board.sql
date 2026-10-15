-- Local integration tests against the already migrated silicon_hustle_test.
-- All fixture writes roll back; existing players and saves are untouched.
begin;
set local statement_timeout = '30s';
set local lock_timeout = '3s';
do $$begin
 if current_database() <> 'silicon_hustle_test' or inet_server_addr() is null
    or not (inet_server_addr() <<= inet '127.0.0.0/8' or inet_server_addr() = inet '::1') then
  raise exception 'Refusing: requires loopback silicon_hustle_test.';
 end if;
end$$;
create temp table original_board on commit drop as select * from public.billionaire_board;
create temp table board_fixture(a uuid,b uuid,c uuid,achievement timestamptz, expected_position bigint) on commit drop;
insert into board_fixture(a,b,c) values(gen_random_uuid(),gen_random_uuid(),gen_random_uuid());
grant select,update on board_fixture to authenticated;
create function pg_temp.assert_true(condition boolean,label text) returns void language plpgsql as $$begin
 if condition is distinct from true then raise exception 'FAIL: %',label;end if;
 raise notice 'PASS: %',label;
end$$;
grant execute on function pg_temp.assert_true(boolean,text) to authenticated,anon;
insert into auth.users(id)
 select a from board_fixture union all select b from board_fixture union all select c from board_fixture;
select pg_temp.assert_true(not has_table_privilege('anon','public.billionaire_board','SELECT'),'anon cannot read private table');
select pg_temp.assert_true(not has_table_privilege('authenticated','public.billionaire_board','INSERT'),'direct insert denied');
select pg_temp.assert_true(not has_table_privilege('authenticated','public.billionaire_board','UPDATE'),'direct update denied');
select pg_temp.assert_true(not has_table_privilege('authenticated','public.billionaire_board','DELETE'),'direct delete denied');
select pg_temp.assert_true(not has_function_privilege('anon','public.submit_billionaire_score(numeric,text,text,uuid)','EXECUTE'),'anon cannot execute submit RPC');
select pg_temp.assert_true(has_function_privilege('anon','public.get_billionaire_board(integer,integer)','EXECUTE'),'anon may read sanitized rankings');

select pg_temp.assert_true((select bool_and(prosecdef and proconfig @> array['search_path=""']) from pg_proc where oid in ('public.get_billionaire_board(integer,integer)'::regprocedure,'public.submit_billionaire_score(numeric,text,text,uuid)'::regprocedure)), 'RPCs are SECURITY DEFINER with empty search_path');
select pg_temp.assert_true((select relrowsecurity from pg_class where oid='public.billionaire_board'::regclass),'RLS enabled');
set local role authenticated;
select set_config('request.jwt.claim.sub',a::text,true),set_config('request.jwt.claims',jsonb_build_object('sub',a)::text,true) from board_fixture;
select pg_temp.assert_true((public.submit_billionaire_score(100000000,'0.9.0','Ada Founder',nullif(current_setting('request.jwt.claim.sub',true),'')::uuid)->>'best_valuation')::bigint=100000000,'join publishes actual personal best');
update board_fixture set achievement=(select achieved_at from public.billionaire_board where user_id=nullif(current_setting('request.jwt.claim.sub',true),'')::uuid);
select pg_temp.assert_true((select count(*) from public.billionaire_board)=1,'owner can read own record');
do $$begin
 begin
  perform public.submit_billionaire_score(200000000,'0.9.0',null,nullif(current_setting('request.jwt.claim.sub',true),'')::uuid);
  raise exception 'FAIL: cooldown was not enforced';
 exception when sqlstate 'P0001' then
  if sqlerrm not like 'Please wait 10 seconds%' then raise;end if;
 end;
 begin
  update public.billionaire_board set best_valuation=1 where user_id=nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
  raise exception 'FAIL: direct lowering was allowed';
 exception when insufficient_privilege then null;
 end;
end$$;
reset role;
-- Test-only backdating avoids sleeping through every rate-limit window.
update public.billionaire_board set last_submission_at=clock_timestamp()-interval '11 seconds' where user_id in (select a from board_fixture union all select b from board_fixture union all select c from board_fixture);
set local role authenticated;
select pg_temp.assert_true((public.submit_billionaire_score(25000000,'0.9.0','New Ada',nullif(current_setting('request.jwt.claim.sub',true),'')::uuid)->>'best_valuation')::bigint=100000000,'lower submission plus rename never lowers best');
select pg_temp.assert_true((select display_name='New Ada' and achieved_at=(select achievement from board_fixture) from public.billionaire_board where user_id=nullif(current_setting('request.jwt.claim.sub',true),'')::uuid),'rename preserves achievement timestamp');

-- Validate input restrictions without relying on client validation.
do $$declare invalid_name text; invalid_score numeric;begin
 foreach invalid_name in array array['MOGABR','M.O.G.A.B.R','Admin','system','moderator','person@example.com','<script>','ab',repeat('x',25),'',E'Ada\nLab','🤑 Founder',repeat('x',97)] loop
  begin
   perform public.submit_billionaire_score(100000000,'0.9.0',invalid_name,nullif(current_setting('request.jwt.claim.sub',true),'')::uuid);
   raise exception 'FAIL: invalid name accepted: %',invalid_name;
  exception when invalid_parameter_value then null;
  end;
 end loop;
 foreach invalid_score in array array[-1::numeric,1.5::numeric,1000000000001::numeric,'NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric,null::numeric] loop
  begin
   perform public.submit_billionaire_score(invalid_score,'0.9.0',null,nullif(current_setting('request.jwt.claim.sub',true),'')::uuid);
   raise exception 'FAIL: invalid score accepted';
  exception when invalid_parameter_value then null;
  end;
 end loop;
 begin
  perform public.submit_billionaire_score(100000000,'future-build',null,nullif(current_setting('request.jwt.claim.sub',true),'')::uuid);
  raise exception 'FAIL: unsupported version accepted';
 exception when invalid_parameter_value then null;
 end;
 raise notice 'PASS: invalid name/score/version matrix rejected';
end$$;
reset role;
update public.billionaire_board set last_submission_at=clock_timestamp()-interval '11 seconds' where user_id in (select a from board_fixture union all select b from board_fixture union all select c from board_fixture);
set local role authenticated;
select pg_temp.assert_true((public.submit_billionaire_score(300000000,'0.9.0',null,nullif(current_setting('request.jwt.claim.sub',true),'')::uuid)->>'best_valuation')::bigint=300000000,'higher score replaces best');
select pg_temp.assert_true((select achieved_at>(select achievement from board_fixture) from public.billionaire_board where user_id=nullif(current_setting('request.jwt.claim.sub',true),'')::uuid),'higher score advances achievement timestamp');

-- Equal score must preserve achievement as well as personal best.
reset role;
update public.billionaire_board set last_submission_at=clock_timestamp()-interval '11 seconds' where user_id=(select a from board_fixture);
set local role authenticated;
select pg_temp.assert_true((public.submit_billionaire_score(300000000,'0.9.0',null,nullif(current_setting('request.jwt.claim.sub',true),'')::uuid)->>'achieved_at')::timestamptz=(select achieved_at from public.billionaire_board where user_id=nullif(current_setting('request.jwt.claim.sub',true),'')::uuid),'equal score preserves achievement');
do $$begin
 begin
  perform public.submit_billionaire_score(1,'0.9.0',null,null);
  raise exception 'FAIL: null expected identity accepted';
 exception when insufficient_privilege then null;end;
end$$;
-- Another authenticated user cannot see/change the first user's private row.
select set_config('request.jwt.claim.sub',b::text,true),set_config('request.jwt.claims',jsonb_build_object('sub',b)::text,true) from board_fixture;
select pg_temp.assert_true((select count(*) from public.billionaire_board)=0,'RLS hides another account record');
do $$begin
 begin
  perform public.submit_billionaire_score(200000000,'0.9.0','Wrong Account',(select a from board_fixture));
  raise exception 'FAIL: mismatched session identity accepted';
 exception when insufficient_privilege then null;
 end;
end$$;
do $$begin
 begin
  perform public.submit_billionaire_score(1,'0.9.0',null,nullif(current_setting('request.jwt.claim.sub',true),'')::uuid);
  raise exception 'FAIL: nameless first join accepted';
 exception when invalid_parameter_value then null;end;
 begin
  perform public.submit_billionaire_score(1,null,'Bob Founder',nullif(current_setting('request.jwt.claim.sub',true),'')::uuid);
  raise exception 'FAIL: null version accepted';
 exception when invalid_parameter_value then null;end;
end$$;
select public.submit_billionaire_score(200000000,'0.9.0','Bob Founder',nullif(current_setting('request.jwt.claim.sub',true),'')::uuid);
select pg_temp.assert_true((select count(*) from public.billionaire_board)=1,'second account reads only its own row');
reset role;
update board_fixture set expected_position=(select count(*)+1 from public.billionaire_board where best_valuation>200000000);
set local role authenticated;
select pg_temp.assert_true((public.get_billionaire_board(1,1000000)->'self'->>'position')::bigint=(select expected_position from board_fixture),'self position is global, not page-local');
select pg_temp.assert_true((public.get_billionaire_board(50,0)->>'total')::int>=2,'public RPC exposes global rankings');
select pg_temp.assert_true(not ((public.get_billionaire_board(50,0)->'entries'->0) ? 'user_id') and not ((public.get_billionaire_board(50,0)->'entries'->0) ? 'email'),'public RPC omits private ID and email');
do $$begin
 begin
  update public.billionaire_board set display_name='Impersonated' where user_id=(select a from board_fixture);
  raise exception 'FAIL: cross-user update allowed';
 exception when insufficient_privilege then null;
 end;
 begin
  insert into public.billionaire_board(user_id,display_name,best_valuation,game_version) select a,'Impersonated',1,'0.9.0' from board_fixture;
  raise exception 'FAIL: cross-user insert allowed';
 exception when insufficient_privilege then null;
 end;
end$$;
reset role;
-- Deterministic tie ordering: earlier achievement wins, then stable public ID.
insert into public.billionaire_board(user_id,public_id,display_name,best_valuation,game_version,achieved_at)
 select c,'00000000-0000-4000-8000-000000000001','Carol Founder',200000000,'0.9.0',clock_timestamp()-interval '1 day' from board_fixture;
select pg_temp.assert_true((public.get_billionaire_board(1,(select count(*)::int from public.billionaire_board where best_valuation>200000000))->'entries'->0->>'public_id')='00000000-0000-4000-8000-000000000001','earlier achievement wins equal-score tie');
update public.billionaire_board set achieved_at='2026-01-01T00:00:00Z',public_id=case when user_id=(select b from board_fixture) then '00000000-0000-4000-8000-000000000002'::uuid else public_id end where user_id in (select b from board_fixture union all select c from board_fixture);
select pg_temp.assert_true((public.get_billionaire_board(1,(select count(*)::int from public.billionaire_board where best_valuation>200000000))->'entries'->0->>'public_id')='00000000-0000-4000-8000-000000000001','public ID breaks exact score/time tie');
select pg_temp.assert_true(jsonb_array_length(public.get_billionaire_board(1,0)->'entries')=1,'pagination limit honored');
select pg_temp.assert_true((public.get_billionaire_board(1,1)->'entries'->0->>'position')::integer=2,'pagination keeps global positions');

select pg_temp.assert_true(jsonb_array_length(public.get_billionaire_board(null,null)->'entries')=least(50,(select count(*)::int from public.billionaire_board)),'null pagination defaults');
select pg_temp.assert_true(jsonb_array_length(public.get_billionaire_board(-1,-1)->'entries')=1,'negative pagination clamped');
select pg_temp.assert_true(jsonb_array_length(public.get_billionaire_board(2147483647,2147483647)->'entries')=0,'huge pagination bounded');
select pg_temp.assert_true(not exists((select * from original_board except select * from public.billionaire_board)),'existing player records unchanged');
-- Boundary values and normalization on fixture C only.
select set_config('request.jwt.claim.sub',c::text,true),set_config('request.jwt.claims',jsonb_build_object('sub',c)::text,true) from board_fixture;
update public.billionaire_board set last_submission_at=clock_timestamp()-interval '11 seconds' where user_id=(select c from board_fixture);
set local role authenticated;
select pg_temp.assert_true((public.submit_billionaire_score(0,'0.9.0','  Carol   Lab  ',nullif(current_setting('request.jwt.claim.sub',true),'')::uuid)->>'display_name')='Carol Lab','zero accepted and name normalized');
reset role;
update public.billionaire_board set last_submission_at=clock_timestamp()-interval '11 seconds' where user_id=(select c from board_fixture);
set local role authenticated;
select pg_temp.assert_true((public.submit_billionaire_score(1000000000000,'0.9.0',null,nullif(current_setting('request.jwt.claim.sub',true),'')::uuid)->>'best_valuation')::bigint=1000000000000,'maximum valuation accepted');
select set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claims','{}',true);
do $$begin
 begin
  perform public.submit_billionaire_score(1,'0.9.0','Missing Auth',null);
  raise exception 'FAIL: missing JWT accepted';
 exception when insufficient_privilege then null;end;
end$$;
reset role;
set local role anon;
select set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claims','{}',true);
select pg_temp.assert_true(public.get_billionaire_board(50,0)->'self'='null'::jsonb,'anonymous reader has no self record');
do $$begin
 begin
  perform 1 from public.billionaire_board;
  raise exception 'FAIL: anonymous table read allowed';
 exception when insufficient_privilege then null;end;
 begin
  perform public.submit_billionaire_score(900000000,'0.9.0','Anonymous',nullif(current_setting('request.jwt.claim.sub',true),'')::uuid);
  raise exception 'FAIL: anonymous submit allowed';
 exception when insufficient_privilege then null;
 end;
end$$;
reset role;
rollback;
