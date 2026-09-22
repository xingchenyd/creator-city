-- Creator City Supabase schema for the two-day demo.
-- Run this once in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  profile_json jsonb not null default '{}'::jsonb,
  display_name text,
  avatar_url text,
  updated_at timestamptz not null default now()
);

create table if not exists public.profile_answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_key text not null,
  question_version int not null default 1,
  answer text not null default '',
  updated_at timestamptz not null default now(),
  unique(user_id, question_key, question_version)
);

create table if not exists public.agent_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_profile_id text not null,
  persona_json jsonb not null,
  model text,
  version int not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(user_id, client_profile_id)
);

create table if not exists public.media_assets (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  mime_type text,
  size_bytes bigint,
  category text,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Earlier draft schemas used a uuid here, but frontend media ids are strings like
-- media-lz0abc1-xxxx. Keep this migration so rerunning the file repairs demos.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'media_assets'
      and column_name = 'id'
      and udt_name = 'uuid'
  ) then
    alter table public.media_assets alter column id drop default;
    alter table public.media_assets alter column id type text using id::text;
  end if;
end $$;

create table if not exists public.debates (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  topic text not null,
  status text not null default 'active',
  runtime_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.debate_participants (
  id uuid primary key default gen_random_uuid(),
  debate_id uuid not null references public.debates(id) on delete cascade,
  agent_profile_id uuid references public.agent_profiles(id) on delete set null,
  builtin_agent_id text,
  display_name text not null,
  persona_snapshot_json jsonb not null default '{}'::jsonb
);

create table if not exists public.debate_messages (
  id uuid primary key default gen_random_uuid(),
  debate_id uuid not null references public.debates(id) on delete cascade,
  speaker_id text not null,
  speaker_name text not null,
  role text not null,
  content text not null,
  sequence int not null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(debate_id, sequence)
);

create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  debate_id uuid references public.debates(id) on delete set null,
  action text not null,
  provider text,
  model text,
  input_tokens int,
  output_tokens int,
  created_at timestamptz not null default now()
);

create index if not exists idx_agent_profiles_user_active on public.agent_profiles(user_id, is_active);
create index if not exists idx_media_assets_user_created on public.media_assets(user_id, created_at desc);
create index if not exists idx_debates_owner_created on public.debates(owner_user_id, created_at desc);
create index if not exists idx_debate_participants_debate on public.debate_participants(debate_id);
create index if not exists idx_debate_participants_agent_profile on public.debate_participants(agent_profile_id);
create index if not exists idx_debate_messages_debate_sequence on public.debate_messages(debate_id, sequence);
create index if not exists idx_usage_events_user_created on public.usage_events(user_id, created_at desc);
create index if not exists idx_usage_events_debate on public.usage_events(debate_id);

alter table public.profiles enable row level security;
alter table public.profile_answers enable row level security;
alter table public.agent_profiles enable row level security;
alter table public.media_assets enable row level security;
alter table public.debates enable row level security;
alter table public.debate_participants enable row level security;
alter table public.debate_messages enable row level security;
alter table public.usage_events enable row level security;

-- Supabase no longer guarantees that newly created public tables are exposed
-- through the Data API. Grant only the authenticated role and keep anon closed.
grant usage on schema public to authenticated;
revoke all on table public.profiles, public.profile_answers, public.agent_profiles,
  public.media_assets, public.debates, public.debate_participants,
  public.debate_messages, public.usage_events from public, anon;
grant select, insert, update, delete on table public.profiles, public.profile_answers,
  public.agent_profiles, public.media_assets, public.debates,
  public.debate_participants, public.debate_messages, public.usage_events to authenticated;

drop policy if exists "profiles_owner_select" on public.profiles;
create policy "profiles_owner_select" on public.profiles
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "profiles_owner_insert" on public.profiles;
create policy "profiles_owner_insert" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "profiles_owner_update" on public.profiles;
create policy "profiles_owner_update" on public.profiles
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "profile_answers_owner_all" on public.profile_answers;
create policy "profile_answers_owner_all" on public.profile_answers
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "agent_profiles_owner_all" on public.agent_profiles;
create policy "agent_profiles_owner_all" on public.agent_profiles
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "media_assets_owner_all" on public.media_assets;
create policy "media_assets_owner_all" on public.media_assets
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "debates_owner_all" on public.debates;
create policy "debates_owner_all" on public.debates
  for all to authenticated using ((select auth.uid()) = owner_user_id) with check ((select auth.uid()) = owner_user_id);

drop policy if exists "debate_participants_owner_all" on public.debate_participants;
create policy "debate_participants_owner_all" on public.debate_participants
  for all to authenticated using (
    exists (
      select 1 from public.debates
      where debates.id = debate_participants.debate_id
        and debates.owner_user_id = (select auth.uid())
    )
  ) with check (
    exists (
      select 1 from public.debates
      where debates.id = debate_participants.debate_id
        and debates.owner_user_id = (select auth.uid())
    )
  );

drop policy if exists "debate_messages_owner_all" on public.debate_messages;
create policy "debate_messages_owner_all" on public.debate_messages
  for all to authenticated using (
    exists (
      select 1 from public.debates
      where debates.id = debate_messages.debate_id
        and debates.owner_user_id = (select auth.uid())
    )
  ) with check (
    exists (
      select 1 from public.debates
      where debates.id = debate_messages.debate_id
        and debates.owner_user_id = (select auth.uid())
    )
  );

drop policy if exists "usage_events_owner_insert_select" on public.usage_events;
create policy "usage_events_owner_insert_select" on public.usage_events
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

insert into storage.buckets (id, name, public)
values ('creator-media', 'creator-media', false)
on conflict (id) do nothing;

drop policy if exists "creator_media_owner_read" on storage.objects;
create policy "creator_media_owner_read" on storage.objects
  for select to authenticated using (
    bucket_id = 'creator-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "creator_media_owner_insert" on storage.objects;
create policy "creator_media_owner_insert" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'creator-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "creator_media_owner_update" on storage.objects;
create policy "creator_media_owner_update" on storage.objects
  for update to authenticated using (
    bucket_id = 'creator-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  ) with check (
    bucket_id = 'creator-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "creator_media_owner_delete" on storage.objects;
create policy "creator_media_owner_delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'creator-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
