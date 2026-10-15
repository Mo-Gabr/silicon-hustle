-- Run in Supabase SQL Editor before enabling cloud saves.
create table if not exists public.game_saves (
 user_id uuid primary key references auth.users(id) on delete cascade,
 game_state jsonb not null,
 updated_at timestamptz not null default now()
);
alter table public.game_saves enable row level security;
drop policy if exists "Owners read saves" on public.game_saves;
create policy "Owners read saves" on public.game_saves for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Owners insert saves" on public.game_saves;
create policy "Owners insert saves" on public.game_saves for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Owners update saves" on public.game_saves;
create policy "Owners update saves" on public.game_saves for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Non-destructive, compatible with existing clients using updated_at as a CAS token.
-- Do not apply to production until reviewed. Existing saves are not modified.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
create or replace function public.game_saves_revision_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
 if TG_OP = 'UPDATE' then
  new.updated_at := greatest(clock_timestamp(), old.updated_at + interval '1 microsecond');
 else
  new.updated_at := clock_timestamp();
 end if;
 return new;
end;
$$;
drop trigger if exists game_saves_revision_guard on public.game_saves;
create trigger game_saves_revision_guard
 before insert or update on public.game_saves
 for each row execute function public.game_saves_revision_guard();
commit;
