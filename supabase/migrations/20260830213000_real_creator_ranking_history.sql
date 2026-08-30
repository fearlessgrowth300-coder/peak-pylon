-- Real Twitch observations and deterministic creator ranking snapshots.
-- Raw observations are server-written and are never writable from the browser.

create table if not exists public.creator_twitch_observations (
  creator_id text not null,
  observed_bucket timestamptz not null,
  observed_at timestamptz not null default now(),
  is_live boolean not null default false,
  viewer_count bigint not null default 0,
  followers bigint,
  game_name text not null default '',
  stream_id text,
  primary key (creator_id, observed_bucket)
);

create index if not exists creator_twitch_observations_creator_time_idx
  on public.creator_twitch_observations (creator_id, observed_at desc);

alter table public.creator_twitch_observations enable row level security;
revoke all on public.creator_twitch_observations from anon, authenticated;

create table if not exists public.creator_metric_snapshots (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null,
  creator_id text not null,
  captured_at timestamptz not null default now(),
  metrics jsonb not null default '{}'::jsonb,
  scores jsonb not null default '{}'::jsonb,
  rank integer not null,
  previous_rank integer not null,
  rank_delta integer not null default 0,
  formula_version text not null default 'streamcore-real-v1',
  ai_headline text,
  ai_summary text,
  ai_strongest_category text,
  ai_model text,
  unique (batch_id, creator_id)
);

create index if not exists creator_metric_snapshots_creator_time_idx
  on public.creator_metric_snapshots (creator_id, captured_at desc);
create index if not exists creator_metric_snapshots_batch_idx
  on public.creator_metric_snapshots (batch_id, rank);

alter table public.creator_metric_snapshots enable row level security;
revoke all on public.creator_metric_snapshots from anon, authenticated;

-- Return aggregated facts only. This keeps raw high-frequency observations
-- private while allowing server-rendered ranking pages to use the history.
create or replace function public.get_creator_twitch_rollups(since_at timestamptz)
returns table (
  creator_id text,
  first_followers bigint,
  latest_followers bigint,
  average_live_viewers numeric,
  peak_live_viewers bigint,
  live_observation_count bigint,
  live_days bigint,
  first_observed_at timestamptz,
  last_observed_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    o.creator_id,
    (array_agg(o.followers order by o.observed_at)
      filter (where o.followers is not null and o.followers > 0))[1] as first_followers,
    (array_agg(o.followers order by o.observed_at desc)
      filter (where o.followers is not null and o.followers > 0))[1] as latest_followers,
    coalesce(avg(o.viewer_count) filter (where o.is_live), 0) as average_live_viewers,
    coalesce(max(o.viewer_count) filter (where o.is_live), 0) as peak_live_viewers,
    count(*) filter (where o.is_live) as live_observation_count,
    count(distinct (o.observed_at at time zone 'utc')::date) filter (where o.is_live) as live_days,
    min(o.observed_at) as first_observed_at,
    max(o.observed_at) as last_observed_at
  from public.creator_twitch_observations o
  where o.observed_at >= since_at
  group by o.creator_id;
$$;

revoke all on function public.get_creator_twitch_rollups(timestamptz) from public;
grant execute on function public.get_creator_twitch_rollups(timestamptz) to anon, authenticated, service_role;

