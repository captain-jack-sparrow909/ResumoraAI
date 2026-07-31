create table if not exists public.applications (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id text references public.job_postings(id) on delete set null,
  resume_id text references public.resumes(id) on delete set null,
  cover_letter_id text references public.cover_letters(id) on delete set null,
  role text not null,
  company text not null default '',
  location text not null default '',
  source_url text not null default '',
  status text not null default 'saved' check (status in ('saved', 'preparing', 'applied', 'interview', 'offer', 'rejected', 'withdrawn')),
  match_score integer not null default 0 check (match_score between 0 and 100),
  cover_letter_snapshot jsonb,
  job_snapshot jsonb,
  notes text not null default '',
  next_action text not null default '',
  next_action_at timestamptz,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.application_activities (
  id text primary key,
  application_id text not null references public.applications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('created', 'status', 'note', 'asset', 'interview', 'review')),
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.interview_packs (
  id text primary key,
  application_id text not null references public.applications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  pack jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (application_id)
);

create table if not exists public.application_reviews (
  id uuid primary key default gen_random_uuid(),
  application_id text not null references public.applications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null default 'Owner',
  target text not null default 'application' check (target in ('application', 'resume', 'cover_letter')),
  body text not null,
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists applications_user_status_idx on public.applications(user_id, status, updated_at desc);
create index if not exists applications_user_next_action_idx on public.applications(user_id, next_action_at) where next_action_at is not null;
create index if not exists application_activities_application_idx on public.application_activities(application_id, created_at desc);
create index if not exists interview_packs_user_updated_idx on public.interview_packs(user_id, updated_at desc);
create index if not exists application_reviews_application_idx on public.application_reviews(application_id, status, created_at desc);

alter table public.applications enable row level security;
alter table public.application_activities enable row level security;
alter table public.interview_packs enable row level security;
alter table public.application_reviews enable row level security;

create policy "applications_owner_all" on public.applications
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "application_activities_owner_all" on public.application_activities
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "interview_packs_owner_all" on public.interview_packs
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "application_reviews_owner_all" on public.application_reviews
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.applications to authenticated;
grant select, insert, update, delete on public.application_activities to authenticated;
grant select, insert, update, delete on public.interview_packs to authenticated;
grant select, insert, update, delete on public.application_reviews to authenticated;
