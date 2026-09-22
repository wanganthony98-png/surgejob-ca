-- Account-bound saved companies / jobs for SurgeJob.
-- Run in Supabase SQL editor if not applied via CLI.

create table if not exists public.user_saved_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  company_id text not null,
  company_name text,
  created_at timestamptz not null default now(),
  unique (user_id, company_id)
);

create index if not exists user_saved_jobs_user_id_idx
  on public.user_saved_jobs (user_id);

alter table public.user_saved_jobs enable row level security;

drop policy if exists "Users read own saved jobs" on public.user_saved_jobs;
create policy "Users read own saved jobs"
  on public.user_saved_jobs for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert own saved jobs" on public.user_saved_jobs;
create policy "Users insert own saved jobs"
  on public.user_saved_jobs for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users delete own saved jobs" on public.user_saved_jobs;
create policy "Users delete own saved jobs"
  on public.user_saved_jobs for delete
  using (auth.uid() = user_id);
