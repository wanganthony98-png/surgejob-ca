-- Join table binding a user's saved jobs / favorites to their auth account.
-- Each row = one company (job) a user has saved. Saved state is per-user and
-- persists across devices/sessions via Supabase.

create table if not exists public.user_saved_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Company IDs in this app are slugs (e.g. "northstar"), so store as text.
  company_id text not null,
  created_at timestamptz not null default now(),
  unique (user_id, company_id)
);

create index if not exists user_saved_jobs_user_id_idx
  on public.user_saved_jobs (user_id);

-- Row Level Security: a user may only read/write their own saved jobs.
alter table public.user_saved_jobs enable row level security;

drop policy if exists "Users can view their saved jobs" on public.user_saved_jobs;
create policy "Users can view their saved jobs"
  on public.user_saved_jobs
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their saved jobs" on public.user_saved_jobs;
create policy "Users can insert their saved jobs"
  on public.user_saved_jobs
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their saved jobs" on public.user_saved_jobs;
create policy "Users can delete their saved jobs"
  on public.user_saved_jobs
  for delete
  using (auth.uid() = user_id);
