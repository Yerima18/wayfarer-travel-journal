-- Wayfarer travel journal table. Run this once in Supabase SQL Editor.
create table if not exists public.travel_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  country_id text not null,
  country_name text not null,
  city text not null check (char_length(city) between 1 and 80),
  visited_on date,
  note text not null default '' check (char_length(note) <= 120),
  created_at timestamptz not null default now()
);

create index if not exists travel_entries_user_created_at_idx
  on public.travel_entries (user_id, created_at desc);

alter table public.travel_entries enable row level security;
revoke all on table public.travel_entries from anon, authenticated;
grant select, insert, update, delete on table public.travel_entries to authenticated;

drop policy if exists "Users can read their own travel entries" on public.travel_entries;
create policy "Users can read their own travel entries"
  on public.travel_entries for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own travel entries" on public.travel_entries;
create policy "Users can create their own travel entries"
  on public.travel_entries for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own travel entries" on public.travel_entries;
create policy "Users can update their own travel entries"
  on public.travel_entries for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own travel entries" on public.travel_entries;
create policy "Users can delete their own travel entries"
  on public.travel_entries for delete to authenticated
  using ((select auth.uid()) = user_id);
