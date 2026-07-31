create extension if not exists "pgcrypto";

create table if not exists public.career_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  profile jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table if not exists public.resumes (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  document jsonb not null,
  score integer not null default 0 check (score between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.resume_versions (
  id uuid primary key default gen_random_uuid(),
  resume_id text not null references public.resumes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  document jsonb not null,
  score integer not null default 0 check (score between 0 and 100),
  created_at timestamptz not null default now()
);

create index if not exists resumes_user_updated_idx on public.resumes(user_id, updated_at desc);
create index if not exists resume_versions_resume_created_idx on public.resume_versions(resume_id, created_at desc);

alter table public.career_profiles enable row level security;
alter table public.resumes enable row level security;
alter table public.resume_versions enable row level security;

create policy "career_profiles_owner_all" on public.career_profiles
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "resumes_owner_all" on public.resumes
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "resume_versions_owner_all" on public.resume_versions
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.career_profiles to authenticated;
grant select, insert, update, delete on public.resumes to authenticated;
grant select, insert, update, delete on public.resume_versions to authenticated;
