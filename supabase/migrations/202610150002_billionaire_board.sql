-- Independent feature migration. DOES NOT reference or migrate game_saves.
-- Apply this file alone after approval; do not apply all pending migrations.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create table public.billionaire_board (
 user_id uuid primary key references auth.users(id) on delete cascade,
 public_id uuid not null unique default gen_random_uuid(),
 display_name text not null,
 best_valuation bigint not null check (best_valuation between 0 and 1000000000000),
 game_version text not null check (game_version in ('0.9.0')),
 achieved_at timestamptz not null default clock_timestamp(),
 name_updated_at timestamptz not null default clock_timestamp(),
 last_submission_at timestamptz not null default clock_timestamp(),
 verification text not null default 'unverified' check (verification = 'unverified'),
 constraint billionaire_founder_name check (
  char_length(display_name) between 3 and 24
  and display_name ~ '^[A-Za-z0-9][A-Za-z0-9 ._-]{2,23}$'
  and display_name = regexp_replace(btrim(display_name), ' +', ' ', 'g')
  and regexp_replace(lower(display_name), '[^a-z0-9]', '', 'g') not in ('mogabr','admin','system','moderator')
 )
);
create index billionaire_board_ranking on public.billionaire_board
 (best_valuation desc, achieved_at asc, public_id asc);
alter table public.billionaire_board enable row level security;
revoke all on table public.billionaire_board from public, anon, authenticated;
grant select on table public.billionaire_board to authenticated;
create policy "Players read own leaderboard record" on public.billionaire_board
 for select to authenticated using ((select auth.uid()) = user_id);
-- No client INSERT/UPDATE/DELETE permissions or policies. Only the RPC writes.

create function public.get_billionaire_board(p_limit integer default 50, p_offset integer default 0)
returns jsonb
language sql stable security definer set search_path = ''
as $$
 with ranked as (
  select b.user_id, b.public_id, b.display_name, b.best_valuation,
         b.game_version, b.achieved_at, b.verification,
         row_number() over (order by b.best_valuation desc, b.achieved_at asc, b.public_id asc) as position
  from public.billionaire_board b
 ), public_rows as (
  select r.user_id, r.position,
   jsonb_build_object('public_id',r.public_id,'display_name',r.display_name,
    'best_valuation',r.best_valuation,'game_version',r.game_version,
    'achieved_at',r.achieved_at,'verification',r.verification,'position',r.position) as item
  from ranked r
 ), page as (
  select p.position,p.item from public_rows p order by p.position
  limit greatest(1,least(coalesce(p_limit,50),50))
  offset greatest(0,least(coalesce(p_offset,0),1000000))
 )
 select jsonb_build_object(
  'entries',coalesce((select jsonb_agg(p.item order by p.position) from page p),'[]'::jsonb),
  'self',(select r.item from public_rows r where r.user_id=(select auth.uid())),
  'total',(select count(*) from public_rows)
 );
$$;
revoke all on function public.get_billionaire_board(integer,integer) from public, anon, authenticated;
grant execute on function public.get_billionaire_board(integer,integer) to anon, authenticated;

create function public.submit_billionaire_score(
 p_valuation numeric, p_game_version text, p_display_name text default null,
 p_expected_user_id uuid default null
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
 v_user_id uuid := auth.uid();
 v_name text;
 v_now timestamptz := clock_timestamp();
 v_result public.billionaire_board%rowtype;
 v_position bigint;
begin
 -- Expected ID is a guard against auth changing while the SDK obtains a token.
 -- It never selects the owner: the only writable owner is still auth.uid().
 if v_user_id is null or p_expected_user_id is distinct from v_user_id then
  raise exception 'Sign in before publishing a score.' using errcode='42501';
 end if;
 if p_valuation is null or p_valuation::text in ('NaN','Infinity','-Infinity')
    or p_valuation < 0 or p_valuation > 1000000000000 or trunc(p_valuation) <> p_valuation then
  raise exception 'Invalid valuation: use whole dollars from 0 to 1000000000000.' using errcode='22023';
 end if;
 if p_game_version is null or p_game_version not in ('0.9.0') then
  raise exception 'Unsupported game version.' using errcode='22023';
 end if;
 if p_display_name is not null then
  if octet_length(p_display_name)>96 then
   raise exception 'Founder name is too long.' using errcode='22023';
  end if;
  v_name := regexp_replace(btrim(p_display_name),' +',' ','g');
  if char_length(v_name) not between 3 and 24 or v_name !~ '^[A-Za-z0-9][A-Za-z0-9 ._-]{2,23}$'
     or regexp_replace(lower(v_name),'[^a-z0-9]','','g') in ('mogabr','admin','system','moderator') then
   raise exception 'Choose 3-24 letters, numbers, spaces, dots, hyphens or underscores; developer names and emails are not allowed.' using errcode='22023';
  end if;
 else
  select b.display_name into v_name from public.billionaire_board b where b.user_id=v_user_id;
  if v_name is null then
   raise exception 'Choose a public founder name before joining the board.' using errcode='22023';
  end if;
 end if;

 -- The unique user_id and ON CONFLICT row lock serialize competing devices.
 -- A lower/stale score can rename a founder, but never lower the stored best.
 insert into public.billionaire_board as b
  (user_id,display_name,best_valuation,game_version,achieved_at,name_updated_at,last_submission_at)
 values (v_user_id,v_name,p_valuation::bigint,p_game_version,v_now,v_now,v_now)
 on conflict (user_id) do update set
  display_name=case when p_display_name is not null then excluded.display_name else b.display_name end,
  best_valuation=greatest(b.best_valuation,excluded.best_valuation),
  game_version=case when excluded.best_valuation>b.best_valuation then excluded.game_version else b.game_version end,
  achieved_at=case when excluded.best_valuation>b.best_valuation then excluded.achieved_at else b.achieved_at end,
  name_updated_at=case when p_display_name is not null and excluded.display_name<>b.display_name then v_now else b.name_updated_at end,
  last_submission_at=v_now
 where b.last_submission_at <= v_now - interval '10 seconds'
 returning b.* into v_result;
 if not found then
  raise exception 'Please wait 10 seconds between leaderboard updates.' using errcode='P0001';
 end if;
 select count(*)+1 into v_position from public.billionaire_board b
 where b.best_valuation>v_result.best_valuation
    or (b.best_valuation=v_result.best_valuation and b.achieved_at<v_result.achieved_at)
    or (b.best_valuation=v_result.best_valuation and b.achieved_at=v_result.achieved_at and b.public_id<v_result.public_id);
 return jsonb_build_object('public_id',v_result.public_id,'display_name',v_result.display_name,
  'best_valuation',v_result.best_valuation,'game_version',v_result.game_version,
  'achieved_at',v_result.achieved_at,'verification',v_result.verification,'position',v_position);
end;
$$;
revoke all on function public.submit_billionaire_score(numeric,text,text,uuid) from public, anon, authenticated;
grant execute on function public.submit_billionaire_score(numeric,text,text,uuid) to authenticated;
comment on table public.billionaire_board is 'Unverified client-submitted personal bests. Developer benchmark is UI-only, outside rankings. No email addresses.';
commit;
