-- Wayfarer photo access. Run this once in Supabase SQL Editor, after schema.sql, photos.sql and social.sql.
-- A friend can see your place photos only after asking and being allowed by you; you can revoke it.

create table if not exists public.photo_access (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  viewer_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved')),
  created_at timestamptz not null default now(),
  unique (owner_id, viewer_id),
  check (owner_id <> viewer_id)
);

create index if not exists photo_access_viewer_idx on public.photo_access (viewer_id);

alter table public.photo_access enable row level security;
revoke all on table public.photo_access from anon, authenticated;
grant select, delete on table public.photo_access to authenticated;
grant update (status) on table public.photo_access to authenticated;

drop policy if exists "People can read their own photo access" on public.photo_access;
create policy "People can read their own photo access"
  on public.photo_access for select to authenticated
  using ((select auth.uid()) in (owner_id, viewer_id));

drop policy if exists "Owners can allow photo access" on public.photo_access;
create policy "Owners can allow photo access"
  on public.photo_access for update to authenticated
  using ((select auth.uid()) = owner_id and status = 'pending')
  with check ((select auth.uid()) = owner_id and status = 'approved');

drop policy if exists "Either person can end photo access" on public.photo_access;
create policy "Either person can end photo access"
  on public.photo_access for delete to authenticated
  using ((select auth.uid()) in (owner_id, viewer_id));

-- True when the two people are accepted friends.
create or replace function public.are_friends(first_user uuid, second_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester_id = first_user and f.addressee_id = second_user)
        or (f.requester_id = second_user and f.addressee_id = first_user))
  );
$$;

-- Asks a friend (by username) to see their photos. Returns: sent | already | not_friends | not_found
create or replace function public.request_photo_access(p_handle text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  viewer uuid := auth.uid();
  owner uuid;
begin
  if viewer is null then
    raise exception 'Not signed in';
  end if;
  select user_id into owner from public.profiles where handle = lower(trim(p_handle));
  if owner is null then
    return 'not_found';
  end if;
  if not public.are_friends(viewer, owner) then
    return 'not_friends';
  end if;
  if exists (select 1 from public.photo_access where owner_id = owner and viewer_id = viewer) then
    return 'already';
  end if;
  insert into public.photo_access (owner_id, viewer_id) values (owner, viewer);
  return 'sent';
end;
$$;

-- Photo requests you received (is_incoming) and sent, with the other person's details.
create or replace function public.list_photo_access()
returns table (
  access_id uuid,
  status text,
  is_incoming boolean,
  handle text,
  display_name text,
  avatar jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    a.id,
    a.status,
    a.owner_id = auth.uid(),
    p.handle,
    p.display_name,
    p.avatar
  from public.photo_access a
  join public.profiles p
    on p.user_id = case when a.owner_id = auth.uid() then a.viewer_id else a.owner_id end
  where auth.uid() in (a.owner_id, a.viewer_id)
    and public.are_friends(a.owner_id, a.viewer_id)
  order by a.created_at desc;
$$;

-- The photos of a friend's places, only if that friend allowed you.
create or replace function public.get_friend_photos(p_handle text)
returns table (entry_id uuid, country_id text, city text, path text)
language sql
stable
security definer
set search_path = public
as $$
  select e.id, e.country_id, e.city, ph.path
  from public.profiles pr
  join public.photo_access a on a.owner_id = pr.user_id and a.viewer_id = auth.uid() and a.status = 'approved'
  join public.travel_entries e on e.user_id = pr.user_id
  join public.entry_photos ph on ph.entry_id = e.id
  where pr.handle = lower(trim(p_handle))
    and public.are_friends(pr.user_id, auth.uid())
  order by e.created_at desc, ph.created_at;
$$;

-- Whether the signed-in person may read this stored photo (it must belong to a place of an owner who allowed them).
create or replace function public.can_view_photo(photo_path text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.entry_photos ph
    join public.photo_access a on a.owner_id = ph.user_id and a.viewer_id = auth.uid() and a.status = 'approved'
    where ph.path = photo_path
      and public.are_friends(ph.user_id, auth.uid())
  );
$$;

drop policy if exists "Approved friends can read shared photo files" on storage.objects;
create policy "Approved friends can read shared photo files"
  on storage.objects for select to authenticated
  using (bucket_id = 'entry-photos' and public.can_view_photo(name));

revoke execute on function public.are_friends(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.request_photo_access(text) from public, anon;
revoke execute on function public.list_photo_access() from public, anon;
revoke execute on function public.get_friend_photos(text) from public, anon;
revoke execute on function public.can_view_photo(text) from public, anon;
grant execute on function public.request_photo_access(text) to authenticated;
grant execute on function public.list_photo_access() to authenticated;
grant execute on function public.get_friend_photos(text) to authenticated;
grant execute on function public.can_view_photo(text) to authenticated;
