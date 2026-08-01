-- A single private row is alternately inserted and deleted by the protected
-- Render cron endpoint. This creates a tiny real database write on every call
-- without accumulating keepalive data.
create table if not exists public.service_liveness (
  singleton boolean primary key default true check (singleton),
  touched_at timestamptz not null default now()
);

alter table public.service_liveness enable row level security;
revoke all on table public.service_liveness from public, anon, authenticated;

-- This second singleton prevents the 13-minute liveness schedule from scanning
-- the whole R2 bucket or running retention deletes more than once per day.
create table if not exists public.service_maintenance_state (
  singleton boolean primary key default true check (singleton),
  last_cleanup_at timestamptz
);

alter table public.service_maintenance_state enable row level security;
revoke all on table public.service_maintenance_state from public, anon, authenticated;

create or replace function public.run_service_maintenance(retention_window_days integer default 60)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  cutoff_at timestamptz;
  liveness_action text;
  cleanup_due boolean := false;
  resume_versions_deleted integer := 0;
  ai_proposals_deleted integer := 0;
  coaching_sessions_deleted integer := 0;
  review_invites_deleted integer := 0;
  organization_invites_deleted integer := 0;
begin
  if retention_window_days < 30 or retention_window_days > 365 then
    raise exception 'retention_window_days must be between 30 and 365';
  end if;

  cutoff_at := now() - make_interval(days => retention_window_days);
  perform pg_advisory_xact_lock(hashtext('resumora-service-maintenance'));

  if exists (select 1 from public.service_liveness where singleton = true) then
    delete from public.service_liveness where singleton = true;
    liveness_action := 'deleted';
  else
    insert into public.service_liveness (singleton, touched_at) values (true, now());
    liveness_action := 'inserted';
  end if;

  insert into public.service_maintenance_state (singleton, last_cleanup_at)
  values (true, null)
  on conflict (singleton) do nothing;

  select last_cleanup_at is null or last_cleanup_at <= now() - interval '24 hours'
  into cleanup_due
  from public.service_maintenance_state
  where singleton = true;

  if cleanup_due then
    -- Primary resumes, applications, portfolios, outcomes, and organization
    -- records are intentionally retained. Only disposable history is expired.
    delete from public.resume_versions where created_at < cutoff_at;
    get diagnostics resume_versions_deleted = row_count;

    delete from public.ai_proposals where created_at < cutoff_at;
    get diagnostics ai_proposals_deleted = row_count;

    delete from public.career_coaching_sessions where created_at < cutoff_at;
    get diagnostics coaching_sessions_deleted = row_count;

    delete from public.application_review_invites
    where created_at < cutoff_at
      and (expires_at < now() or revoked_at is not null or accepted_at is not null);
    get diagnostics review_invites_deleted = row_count;

    delete from public.organization_invites
    where created_at < cutoff_at
      and (expires_at < now() or revoked_at is not null or accepted_at is not null);
    get diagnostics organization_invites_deleted = row_count;

    update public.service_maintenance_state set last_cleanup_at = now() where singleton = true;
  end if;

  return jsonb_build_object(
    'livenessAction', liveness_action,
    'cleanupRan', cleanup_due,
    'cutoff', cutoff_at,
    'deleted', jsonb_build_object(
      'resumeVersions', resume_versions_deleted,
      'aiProposals', ai_proposals_deleted,
      'careerCoachingSessions', coaching_sessions_deleted,
      'applicationReviewInvites', review_invites_deleted,
      'organizationInvites', organization_invites_deleted
    )
  );
end;
$$;

revoke all on function public.run_service_maintenance(integer) from public, anon, authenticated;
grant execute on function public.run_service_maintenance(integer) to service_role;

-- Make the newly created RPC visible to PostgREST immediately.
notify pgrst, 'reload schema';
