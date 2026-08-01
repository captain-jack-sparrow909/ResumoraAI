-- Minimal maintenance schema used directly by the Render API. No PostgREST
-- RPC discovery is required.
create table if not exists public.service_liveness (
  singleton boolean primary key default true check (singleton),
  touched_at timestamptz not null default now()
);

create table if not exists public.service_maintenance_state (
  singleton boolean primary key default true check (singleton),
  last_cleanup_at timestamptz
);

alter table public.service_liveness enable row level security;
alter table public.service_maintenance_state enable row level security;

revoke all on table public.service_liveness from public, anon, authenticated;
revoke all on table public.service_maintenance_state from public, anon, authenticated;
grant select, insert, update, delete on table public.service_liveness to service_role;
grant select, insert, update, delete on table public.service_maintenance_state to service_role;

notify pgrst, 'reload schema';
