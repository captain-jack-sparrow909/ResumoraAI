create table if not exists public.career_goals (
  user_id uuid primary key references auth.users(id) on delete cascade,
  target_role_id text not null,
  target_title text not null,
  horizon_months integer not null default 12 check (horizon_months between 1 and 36),
  weekly_hours integer not null default 5 check (weekly_hours between 1 and 30),
  priorities jsonb not null default '[]'::jsonb,
  taxonomy_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.career_outcomes (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  application_id text references public.applications(id) on delete set null,
  stage text not null check (stage in ('application', 'recruiter_screen', 'hiring_manager', 'assessment', 'onsite', 'offer')),
  result text not null check (result in ('pending', 'advanced', 'rejected', 'withdrawn', 'accepted')),
  reason_tags jsonb not null default '[]'::jsonb,
  notes text not null default '',
  occurred_at timestamptz not null,
  include_in_insights boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.career_learning_plans (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  target_role_id text not null,
  plan jsonb not null,
  model text not null default 'deterministic',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.career_coaching_sessions (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  target_role_id text not null,
  question text not null,
  answer text not null,
  feedback jsonb not null,
  model text not null default 'deterministic',
  created_at timestamptz not null default now()
);

create index if not exists career_outcomes_user_occurred_idx on public.career_outcomes(user_id, occurred_at desc);
create index if not exists career_learning_plans_user_target_idx on public.career_learning_plans(user_id, target_role_id, updated_at desc);
create index if not exists career_coaching_sessions_user_created_idx on public.career_coaching_sessions(user_id, created_at desc);

alter table public.career_goals enable row level security;
alter table public.career_outcomes enable row level security;
alter table public.career_learning_plans enable row level security;
alter table public.career_coaching_sessions enable row level security;

create policy "career_goals_owner_all" on public.career_goals
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "career_outcomes_owner_all" on public.career_outcomes
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "career_learning_plans_owner_all" on public.career_learning_plans
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "career_coaching_sessions_owner_all" on public.career_coaching_sessions
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.career_goals to authenticated;
grant select, insert, update, delete on public.career_outcomes to authenticated;
grant select, insert, update, delete on public.career_learning_plans to authenticated;
grant select, insert, update, delete on public.career_coaching_sessions to authenticated;
