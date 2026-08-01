create table if not exists public.portfolio_publications (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  configuration jsonb not null,
  public_snapshot jsonb not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'revoked')),
  consent_version text not null default 'portfolio-v1',
  consented_at timestamptz,
  published_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  type text not null check (type in ('coaching', 'university', 'outplacement', 'employer')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null default '',
  email text not null default '',
  role text not null check (role in ('owner', 'admin', 'coach', 'participant')),
  joined_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table if not exists public.organization_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin', 'coach', 'participant')),
  token_hash text not null unique,
  invited_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.organization_data_grants (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  participant_user_id uuid not null references auth.users(id) on delete cascade,
  scopes jsonb not null default '[]'::jsonb,
  consented_at timestamptz not null default now(),
  revoked_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (organization_id, participant_user_id)
);

create table if not exists public.organization_participant_profiles (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  participant_user_id uuid not null references auth.users(id) on delete cascade,
  shared_profile jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (organization_id, participant_user_id)
);

create table if not exists public.organization_cohorts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.organization_cohort_members (
  cohort_id uuid not null references public.organization_cohorts(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  participant_user_id uuid not null references auth.users(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (cohort_id, participant_user_id)
);

create index if not exists portfolio_publications_user_updated_idx on public.portfolio_publications(user_id, updated_at desc);
create index if not exists portfolio_publications_public_slug_idx on public.portfolio_publications(slug) where status = 'published';
create index if not exists organization_members_user_idx on public.organization_members(user_id, joined_at desc);
create index if not exists organization_invites_org_idx on public.organization_invites(organization_id, created_at desc);
create index if not exists organization_profiles_org_idx on public.organization_participant_profiles(organization_id, updated_at desc);
create index if not exists organization_cohorts_org_idx on public.organization_cohorts(organization_id, created_at desc);

create or replace function public.is_organization_member(check_organization_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.organization_members where organization_id = check_organization_id and user_id = (select auth.uid())) $$;

create or replace function public.is_organization_staff(check_organization_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.organization_members where organization_id = check_organization_id and user_id = (select auth.uid()) and role in ('owner', 'admin', 'coach')) $$;

create or replace function public.has_organization_scope(check_organization_id uuid, check_participant_user_id uuid, check_scope text)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.organization_data_grants where organization_id = check_organization_id and participant_user_id = check_participant_user_id and revoked_at is null and scopes ? check_scope) $$;

alter table public.portfolio_publications enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.organization_invites enable row level security;
alter table public.organization_data_grants enable row level security;
alter table public.organization_participant_profiles enable row level security;
alter table public.organization_cohorts enable row level security;
alter table public.organization_cohort_members enable row level security;

create policy "portfolio_publications_owner_all" on public.portfolio_publications
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "organizations_member_select" on public.organizations
  for select using (public.is_organization_member(id) or created_by = (select auth.uid()));
create policy "organizations_creator_insert" on public.organizations
  for insert with check (created_by = (select auth.uid()));
create policy "organizations_admin_update" on public.organizations
  for update using (public.is_organization_staff(id)) with check (public.is_organization_staff(id));
create policy "organization_members_visible" on public.organization_members
  for select using (user_id = (select auth.uid()) or public.is_organization_staff(organization_id));
create policy "organization_members_staff_manage" on public.organization_members
  for all using (public.is_organization_staff(organization_id)) with check (public.is_organization_staff(organization_id));
create policy "organization_invites_staff_all" on public.organization_invites
  for all using (public.is_organization_staff(organization_id)) with check (public.is_organization_staff(organization_id));
create policy "organization_grants_participant_all" on public.organization_data_grants
  for all using (participant_user_id = (select auth.uid())) with check (participant_user_id = (select auth.uid()));
create policy "organization_profiles_participant_all" on public.organization_participant_profiles
  for all using (participant_user_id = (select auth.uid())) with check (participant_user_id = (select auth.uid()));
create policy "organization_profiles_staff_select" on public.organization_participant_profiles
  for select using (public.is_organization_staff(organization_id) and public.has_organization_scope(organization_id, participant_user_id, 'resume_summary'));
create policy "organization_cohorts_member_select" on public.organization_cohorts
  for select using (public.is_organization_member(organization_id));
create policy "organization_cohorts_staff_manage" on public.organization_cohorts
  for all using (public.is_organization_staff(organization_id)) with check (public.is_organization_staff(organization_id));
create policy "organization_cohort_members_visible" on public.organization_cohort_members
  for select using (participant_user_id = (select auth.uid()) or public.is_organization_staff(organization_id));
create policy "organization_cohort_members_staff_manage" on public.organization_cohort_members
  for all using (public.is_organization_staff(organization_id)) with check (public.is_organization_staff(organization_id));

grant select, insert, update, delete on public.portfolio_publications to authenticated;
grant select, insert, update, delete on public.organizations to authenticated;
grant select, insert, update, delete on public.organization_members to authenticated;
grant select, insert, update, delete on public.organization_invites to authenticated;
grant select, insert, update, delete on public.organization_data_grants to authenticated;
grant select, insert, update, delete on public.organization_participant_profiles to authenticated;
grant select, insert, update, delete on public.organization_cohorts to authenticated;
grant select, insert, update, delete on public.organization_cohort_members to authenticated;

-- Public portfolio reads and invite-token acceptance intentionally have no anon
-- grants. The Render API exposes only stored public snapshots after validating
-- publication status or a hashed, unexpired invitation token.
