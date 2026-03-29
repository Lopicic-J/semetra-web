-- Semetra Web — Initial Schema (v2)
-- Run this in the Supabase SQL Editor

create extension if not exists "uuid-ossp";

-- ── Modules ──────────────────────────────────────────────────────────────────
create table if not exists modules (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  name        text not null,
  professor   text,
  ects        integer,
  semester    text,
  day         text,
  time_start  text,
  time_end    text,
  room        text,
  color       text default '#6d28d9',
  notes       text,
  created_at  timestamptz default now()
);
alter table modules enable row level security;
create policy "modules_own" on modules for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Tasks ─────────────────────────────────────────────────────────────────────
create table if not exists tasks (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  module_id   uuid references modules(id) on delete set null,
  title       text not null,
  description text,
  due_date    timestamptz,
  priority    text default 'medium',
  status      text default 'todo',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
alter table tasks enable row level security;
create policy "tasks_own" on tasks for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Calendar Events ───────────────────────────────────────────────────────────
create table if not exists events (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  title       text not null,
  start_dt    timestamptz not null,
  end_dt      timestamptz,
  location    text,
  description text,
  color       text default '#6d28d9',
  event_type  text default 'general',
  created_at  timestamptz default now()
);
alter table events enable row level security;
create policy "events_own" on events for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Time Logs ─────────────────────────────────────────────────────────────────
create table if not exists time_logs (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid references auth.users(id) on delete cascade not null,
  module_id        uuid references modules(id) on delete set null,
  duration_seconds integer not null default 0,
  started_at       timestamptz not null default now(),
  note             text,
  created_at       timestamptz default now()
);
alter table time_logs enable row level security;
create policy "time_logs_own" on time_logs for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Topics / Lernziele ────────────────────────────────────────────────────────
create table if not exists topics (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  module_id   uuid references modules(id) on delete set null,
  parent_id   uuid references topics(id) on delete cascade,
  title       text not null,
  description text,
  status      text default 'not_started',
  created_at  timestamptz default now()
);
alter table topics enable row level security;
create policy "topics_own" on topics for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Grades ────────────────────────────────────────────────────────────────────
create table if not exists grades (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  module_id   uuid references modules(id) on delete set null,
  title       text not null,
  grade       numeric not null,
  weight      numeric default 1,
  date        text,
  exam_type   text,
  notes       text,
  created_at  timestamptz default now()
);
alter table grades enable row level security;
create policy "grades_own" on grades for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Stundenplan ───────────────────────────────────────────────────────────────
create table if not exists stundenplan (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  module_id   uuid references modules(id) on delete set null,
  title       text not null,
  day         text not null,
  time_start  text not null,
  time_end    text not null,
  room        text,
  color       text default '#6d28d9',
  created_at  timestamptz default now()
);
alter table stundenplan enable row level security;
create policy "stundenplan_own" on stundenplan for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── App Settings ──────────────────────────────────────────────────────────────
create table if not exists app_settings (
  user_id uuid references auth.users(id) on delete cascade not null,
  key     text not null,
  value   text not null,
  primary key (user_id, key)
);
alter table app_settings enable row level security;
create policy "settings_own" on app_settings for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Realtime ──────────────────────────────────────────────────────────────────
alter publication supabase_realtime add table modules;
alter publication supabase_realtime add table tasks;
alter publication supabase_realtime add table events;
