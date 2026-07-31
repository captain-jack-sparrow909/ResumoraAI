create table if not exists public.job_postings (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  company text not null default '',
  description text not null,
  analysis jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.resume_variants (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  source_resume_id text not null references public.resumes(id) on delete cascade,
  target_job_id text references public.job_postings(id) on delete set null,
  title text not null,
  document jsonb not null,
  match_score integer not null default 0 check (match_score between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_proposals (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  resume_id text references public.resumes(id) on delete cascade,
  job_id text references public.job_postings(id) on delete cascade,
  proposal jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'dismissed')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create table if not exists public.cover_letters (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  resume_id text references public.resumes(id) on delete set null,
  job_id text references public.job_postings(id) on delete cascade,
  subject text not null,
  content text not null,
  evidence_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists job_postings_user_created_idx on public.job_postings(user_id, created_at desc);
create index if not exists resume_variants_user_job_idx on public.resume_variants(user_id, target_job_id);
create index if not exists ai_proposals_user_job_idx on public.ai_proposals(user_id, job_id, created_at desc);
create index if not exists cover_letters_user_job_idx on public.cover_letters(user_id, job_id, updated_at desc);

alter table public.job_postings enable row level security;
alter table public.resume_variants enable row level security;
alter table public.ai_proposals enable row level security;
alter table public.cover_letters enable row level security;

create policy "job_postings_owner_all" on public.job_postings
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "resume_variants_owner_all" on public.resume_variants
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "ai_proposals_owner_all" on public.ai_proposals
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "cover_letters_owner_all" on public.cover_letters
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.job_postings to authenticated;
grant select, insert, update, delete on public.resume_variants to authenticated;
grant select, insert, update, delete on public.ai_proposals to authenticated;
grant select, insert, update, delete on public.cover_letters to authenticated;
