-- =====================================================================
-- MuscleUp — profiles + leaderboard
-- =====================================================================
--
-- Run this once in the Supabase SQL editor (Dashboard → SQL Editor → New
-- query → paste → Run). It is safe to re-run: everything is guarded.
--
-- What it sets up:
--
--   * public.profiles — one row per registered account, holding the name
--     the athlete chose plus the rep totals the leaderboard ranks by.
--   * a trigger on auth.users so *every* account gets a row the moment it
--     signs up, which is what makes "every user ever registered" appear on
--     the leaderboard even before they fill the profile form in.
--   * row-level security: anyone may read the board, but a row can only be
--     written by the account that owns it.
--
-- No email address is stored here. The table is world readable, and the
-- leaderboard has no business handing out everyone's address.
-- =====================================================================

create table if not exists public.profiles (
  id                    uuid primary key references auth.users (id) on delete cascade,
  username              text,          -- unique, case-insensitively (index below)
  first_name            text,
  last_name             text,

  -- aggregates published by the browser as reps are logged
  total_reps            integer     not null default 0,
  category_reps         jsonb       not null default '{}'::jsonb,
  top_category          text,
  favourite_skill       text,          -- "push:pushup"
  favourite_skill_label text,          -- "Push-Up", snapshotted for display

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

comment on table public.profiles is
  'Public athlete profile: one row per auth user, created on signup by handle_new_user().';

-- keep usernames case-insensitively unique ("Ben" must not sit next to "ben")
create unique index if not exists profiles_username_lower_idx
  on public.profiles (lower(username));

-- the leaderboard's default ordering
create index if not exists profiles_total_reps_idx
  on public.profiles (total_reps desc);

-- usernames are 3–20 characters of letters, numbers and underscores, the
-- same rule the profile form enforces in the browser
alter table public.profiles drop constraint if exists profiles_username_format;
alter table public.profiles add constraint profiles_username_format
  check (username is null or username ~ '^[A-Za-z0-9_]{3,20}$');

-- one of the five branches, or nothing logged yet
alter table public.profiles drop constraint if exists profiles_top_category_valid;
alter table public.profiles add constraint profiles_top_category_valid
  check (top_category is null or top_category in ('push', 'pull', 'legs', 'core', 'cardio'));

alter table public.profiles drop constraint if exists profiles_total_reps_positive;
alter table public.profiles add constraint profiles_total_reps_positive
  check (total_reps >= 0);


-- ---------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists "Profiles are readable by everyone" on public.profiles;
create policy "Profiles are readable by everyone"
  on public.profiles for select
  using (true);

drop policy if exists "Users insert their own profile" on public.profiles;
create policy "Users insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Users update their own profile" on public.profiles;
create policy "Users update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- no delete policy: a profile disappears only with its account


-- ---------------------------------------------------------------------
-- Every new account gets a profile row
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ---------------------------------------------------------------------
-- updated_at bookkeeping
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();


-- ---------------------------------------------------------------------
-- Backfill: accounts that registered before this table existed
-- ---------------------------------------------------------------------
insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;
