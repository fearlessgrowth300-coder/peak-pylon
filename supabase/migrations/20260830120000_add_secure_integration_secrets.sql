-- Server-managed credentials entered by the community owner.
-- This table has no browser-readable RLS policy and is accessed only through
-- authenticated server functions after an explicit admin-role check.
create table if not exists public.integration_secrets (
  secret_name text primary key,
  secret_value text not null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.integration_secrets enable row level security;

revoke all on table public.integration_secrets from anon, authenticated;
grant all on table public.integration_secrets to service_role;

comment on table public.integration_secrets is
  'Encrypted-at-rest integration credentials available only to trusted server functions.';
