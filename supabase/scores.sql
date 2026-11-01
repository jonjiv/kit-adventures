-- The global leaderboard for Kit Adventures.
-- Paste this into the Supabase SQL Editor once and press Run.
-- Anyone can read the scores and add a new one; nobody can change or delete
-- them except you, from the Supabase Table Editor.

create table public.scores (
  id bigint generated always as identity primary key,
  level text not null check (level in ('tutorial', 'garden', 'city', 'moon')),
  name text not null check (char_length(name) between 1 and 12),
  time_ms integer not null check (time_ms between 5000 and 3600000),
  created_at timestamptz not null default now()
);

create index scores_by_level_and_time on public.scores (level, time_ms);

alter table public.scores enable row level security;

create policy "Anyone can read scores" on public.scores
  for select to anon using (true);

create policy "Anyone can add a score" on public.scores
  for insert to anon with check (true);

grant select, insert on public.scores to anon;
