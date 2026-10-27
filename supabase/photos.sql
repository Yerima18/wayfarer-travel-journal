-- Wayfarer photos. Run this once in Supabase SQL Editor, after schema.sql.

-- One row per photo; the image itself lives in the private "entry-photos" bucket.
create table if not exists public.entry_photos (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.travel_entries (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  path text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists entry_photos_entry_idx on public.entry_photos (entry_id);

alter table public.entry_photos enable row level security;
revoke all on table public.entry_photos from anon, authenticated;
grant select, insert, delete on table public.entry_photos to authenticated;

drop policy if exists "Users can read their own photos" on public.entry_photos;
create policy "Users can read their own photos"
  on public.entry_photos for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can add photos to their own entries" on public.entry_photos;
create policy "Users can add photos to their own entries"
  on public.entry_photos for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.travel_entries entry
      where entry.id = entry_id and entry.user_id = (select auth.uid())
    )
  );

drop policy if exists "Users can delete their own photos" on public.entry_photos;
create policy "Users can delete their own photos"
  on public.entry_photos for delete to authenticated
  using ((select auth.uid()) = user_id);

-- At most 5 photos per place, enforced here as well as in the app.
create or replace function public.enforce_photo_limit()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from public.entry_photos where entry_id = new.entry_id) >= 5 then
    raise exception 'A place can have at most 5 photos';
  end if;
  return new;
end;
$$;

drop trigger if exists entry_photos_limit on public.entry_photos;
create trigger entry_photos_limit
  before insert on public.entry_photos
  for each row execute function public.enforce_photo_limit();

-- Private bucket: files are only reachable by their owner (folder name = user id).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('entry-photos', 'entry-photos', false, 3145728, array['image/jpeg'])
on conflict (id) do update
  set public = false, file_size_limit = 3145728, allowed_mime_types = array['image/jpeg'];

drop policy if exists "Users can read their own photo files" on storage.objects;
create policy "Users can read their own photo files"
  on storage.objects for select to authenticated
  using (bucket_id = 'entry-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users can upload their own photo files" on storage.objects;
create policy "Users can upload their own photo files"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'entry-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users can delete their own photo files" on storage.objects;
create policy "Users can delete their own photo files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'entry-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
