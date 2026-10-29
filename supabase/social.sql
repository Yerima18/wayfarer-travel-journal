-- Wayfarer sharing and friends. Run this once in Supabase SQL Editor, after schema.sql.
-- Visitors never read your private tables: they only get what the functions below return.

-- One row per person who chose a username. It holds what they allow others to see.
create table if not exists public.profiles (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  handle text not null unique
    check (handle ~ '^[a-z0-9_-]{3,20}$')
    check (handle not in ('admin', 'wayfarer', 'support', 'help', 'api', 'auth', 'u', 'root', 'moderator')),
  display_name text not null check (char_length(display_name) between 1 and 30),
  avatar jsonb not null default '{}'::jsonb
    check (jsonb_typeof(avatar) = 'object' and octet_length(avatar::text) <= 300),
  link_enabled boolean not null default false,
  show_cities boolean not null default false,
  show_wishlist boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
revoke all on table public.profiles from anon, authenticated;
grant select, insert, update, delete on table public.profiles to authenticated;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own profile" on public.profiles;
create policy "Users can create their own profile"
  on public.profiles for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own profile" on public.profiles;
create policy "Users can delete their own profile"
  on public.profiles for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Friend requests. "pending" until the addressee accepts.
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  addressee_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  check (requester_id <> addressee_id)
);

-- One friendship per pair of people, whoever asked first.
create unique index if not exists friendships_pair_idx
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index if not exists friendships_addressee_idx on public.friendships (addressee_id);

alter table public.friendships enable row level security;
revoke all on table public.friendships from anon, authenticated;
grant select, insert, delete on table public.friendships to authenticated;
grant update (status) on table public.friendships to authenticated;

drop policy if exists "People can read their own friendships" on public.friendships;
create policy "People can read their own friendships"
  on public.friendships for select to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));

drop policy if exists "People can send friend requests" on public.friendships;
create policy "People can send friend requests"
  on public.friendships for insert to authenticated
  with check ((select auth.uid()) = requester_id and status = 'pending');

drop policy if exists "Addressees can accept requests" on public.friendships;
create policy "Addressees can accept requests"
  on public.friendships for update to authenticated
  using ((select auth.uid()) = addressee_id and status = 'pending')
  with check ((select auth.uid()) = addressee_id and status = 'accepted');

drop policy if exists "Either person can end a friendship" on public.friendships;
create policy "Either person can end a friendship"
  on public.friendships for delete to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));

-- Keeps one account from flooding others with requests.
create or replace function public.enforce_friendship_limit()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from public.friendships where requester_id = new.requester_id) >= 200 then
    raise exception 'Too many friend requests';
  end if;
  return new;
end;
$$;

drop trigger if exists friendships_limit on public.friendships;
create trigger friendships_limit
  before insert on public.friendships
  for each row execute function public.enforce_friendship_limit();

-- Sends a request by username. If that person already asked you, it becomes a friendship.
-- Returns: sent | accepted | already | self | not_found
create or replace function public.send_friend_request(p_handle text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  viewer uuid := auth.uid();
  target uuid;
  existing public.friendships;
begin
  if viewer is null then
    raise exception 'Not signed in';
  end if;
  select user_id into target from public.profiles where handle = lower(trim(p_handle));
  if target is null then
    return 'not_found';
  end if;
  if target = viewer then
    return 'self';
  end if;

  select * into existing from public.friendships
  where (requester_id = viewer and addressee_id = target) or (requester_id = target and addressee_id = viewer);

  if found then
    if existing.status = 'pending' and existing.addressee_id = viewer then
      update public.friendships set status = 'accepted' where id = existing.id;
      return 'accepted';
    end if;
    return 'already';
  end if;

  insert into public.friendships (requester_id, addressee_id) values (viewer, target);
  return 'sent';
end;
$$;

-- Your friend requests and friends, with the other person's public details.
create or replace function public.list_friendships()
returns table (
  friendship_id uuid,
  status text,
  is_incoming boolean,
  handle text,
  display_name text,
  avatar jsonb,
  country_count integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    f.id,
    f.status,
    f.addressee_id = auth.uid(),
    p.handle,
    p.display_name,
    p.avatar,
    case when f.status = 'accepted'
      then (select count(distinct e.country_id)::integer from public.travel_entries e where e.user_id = p.user_id)
    end
  from public.friendships f
  join public.profiles p
    on p.user_id = case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end
  where auth.uid() in (f.requester_id, f.addressee_id)
  order by f.created_at desc;
$$;

-- What a visitor may see of a username: the owner, accepted friends, or anyone if the link is on.
-- Photos, notes and dates are never included.
create or replace function public.get_shared_profile(p_handle text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  viewer uuid := auth.uid();
  shared public.profiles;
  is_friend boolean := false;
begin
  select * into shared from public.profiles where handle = lower(trim(p_handle));
  if not found then
    return null;
  end if;

  if viewer is not null then
    is_friend := exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and ((f.requester_id = viewer and f.addressee_id = shared.user_id)
          or (f.addressee_id = viewer and f.requester_id = shared.user_id))
    );
  end if;

  if not (shared.link_enabled or is_friend or viewer = shared.user_id) then
    return null;
  end if;

  return jsonb_build_object(
    'handle', shared.handle,
    'display_name', shared.display_name,
    'avatar', shared.avatar,
    'is_friend', is_friend,
    'is_owner', viewer = shared.user_id,
    'countries', coalesce(
      (select jsonb_agg(distinct e.country_id) from public.travel_entries e where e.user_id = shared.user_id),
      '[]'::jsonb),
    'cities', case when shared.show_cities then coalesce(
      (select jsonb_agg(jsonb_build_object('country_id', c.country_id, 'city', c.city) order by c.country_id, c.city)
         from (select distinct e.country_id, e.city from public.travel_entries e where e.user_id = shared.user_id) c),
      '[]'::jsonb) end,
    'wishlist', case when shared.show_wishlist then coalesce(
      (select case when jsonb_typeof(u.raw_user_meta_data -> 'wishlist') = 'array' then u.raw_user_meta_data -> 'wishlist' end
         from auth.users u where u.id = shared.user_id),
      '[]'::jsonb) end
  );
end;
$$;

revoke execute on function public.send_friend_request(text) from public, anon;
revoke execute on function public.list_friendships() from public, anon;
revoke execute on function public.get_shared_profile(text) from public;
grant execute on function public.send_friend_request(text) to authenticated;
grant execute on function public.list_friendships() to authenticated;
grant execute on function public.get_shared_profile(text) to anon, authenticated;
