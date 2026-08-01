create table if not exists public.application_review_invites (
  id uuid primary key default gen_random_uuid(),
  application_id text not null references public.applications(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  reviewer_name text not null default '',
  reviewer_email text not null,
  role text not null default 'reviewer' check (role in ('mentor', 'reviewer', 'hiring_coach')),
  target text not null default 'resume' check (target in ('application', 'resume', 'cover_letter')),
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.application_reviews
  add column if not exists invite_id uuid references public.application_review_invites(id) on delete set null,
  add column if not exists decision text not null default 'comment' check (decision in ('comment', 'approved', 'changes_requested'));

create index if not exists review_invites_owner_application_idx
  on public.application_review_invites(owner_user_id, application_id, created_at desc);
create index if not exists review_invites_token_hash_idx
  on public.application_review_invites(token_hash);
create index if not exists application_reviews_invite_idx
  on public.application_reviews(invite_id, created_at desc);

alter table public.application_review_invites enable row level security;

create policy "application_review_invites_owner_all" on public.application_review_invites
  for all using ((select auth.uid()) = owner_user_id) with check ((select auth.uid()) = owner_user_id);

grant select, insert, update, delete on public.application_review_invites to authenticated;

-- External review links are intentionally not granted to anon. The Render API
-- validates the hashed, expiring token and uses the server-only Supabase key.
