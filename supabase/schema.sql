-- Run in Supabase SQL Editor before enabling cloud saves.
create table if not exists public.game_saves (
 user_id uuid primary key references auth.users(id) on delete cascade,
 game_state jsonb not null,
 updated_at timestamptz not null default now()
);
alter table public.game_saves enable row level security;
create policy "Owners read saves" on public.game_saves for select to authenticated using ((select auth.uid()) = user_id);
create policy "Owners insert saves" on public.game_saves for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Owners update saves" on public.game_saves for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
