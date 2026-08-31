-- Connect every control-center activity interval to a real server-side cron job.
-- pg_cron supports 1-59 second schedules, so sub-minute activity continues even
-- when the admin closes the browser.

create or replace function public.streamcore_ai_schedule_for_interval(interval_minutes numeric)
returns text
language plpgsql
immutable
strict
set search_path = public, pg_catalog
as $$
begin
  if abs(interval_minutes - (8.0 / 60.0)) < 0.000001 then return '8 seconds'; end if;
  if abs(interval_minutes - (15.0 / 60.0)) < 0.000001 then return '15 seconds'; end if;
  if abs(interval_minutes - (20.0 / 60.0)) < 0.000001 then return '20 seconds'; end if;
  if abs(interval_minutes - (30.0 / 60.0)) < 0.000001 then return '30 seconds'; end if;
  if abs(interval_minutes - (45.0 / 60.0)) < 0.000001 then return '45 seconds'; end if;
  if interval_minutes = 1 then return '* * * * *'; end if;
  if interval_minutes = 2 then return '*/2 * * * *'; end if;
  if interval_minutes = 5 then return '*/5 * * * *'; end if;
  if interval_minutes = 10 then return '*/10 * * * *'; end if;
  if interval_minutes = 15 then return '*/15 * * * *'; end if;
  if interval_minutes = 30 then return '*/30 * * * *'; end if;
  if interval_minutes = 60 then return '0 * * * *'; end if;
  raise exception 'Unsupported StreamCore activity interval: % minutes', interval_minutes;
end;
$$;

create or replace function public.configure_streamcore_ai_autopilot_schedule(
  interval_minutes numeric,
  is_active boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog, cron
as $$
declare
  schedule_text text;
  scheduled_job_id bigint;
begin
  if not coalesce(is_active, false) then
    begin
      perform cron.unschedule('streamcore-ai-autopilot');
    exception when others then
      null;
    end;
    return jsonb_build_object('active', false, 'schedule', null);
  end if;

  schedule_text := public.streamcore_ai_schedule_for_interval(interval_minutes);
  select cron.schedule(
    'streamcore-ai-autopilot',
    schedule_text,
    'select public.run_streamcore_ai_autopilot(false);'
  ) into scheduled_job_id;

  return jsonb_build_object(
    'active', true,
    'intervalMinutes', interval_minutes,
    'schedule', schedule_text,
    'jobId', scheduled_job_id
  );
end;
$$;

revoke all on function public.streamcore_ai_schedule_for_interval(numeric) from public, anon, authenticated;
revoke all on function public.configure_streamcore_ai_autopilot_schedule(numeric, boolean) from public, anon, authenticated;
grant execute on function public.streamcore_ai_schedule_for_interval(numeric) to service_role;
grant execute on function public.configure_streamcore_ai_autopilot_schedule(numeric, boolean) to service_role;

do $$
declare
  current_config jsonb;
  current_interval numeric;
  current_active boolean;
begin
  select setting_value into current_config
  from public.integration_settings
  where setting_name = 'ai_autopilot';

  current_config := coalesce(current_config, '{}'::jsonb);
  current_interval := coalesce((current_config->>'intervalMinutes')::numeric, 10);
  current_active := coalesce((current_config->>'active')::boolean, false);

  if public.streamcore_ai_schedule_for_interval(current_interval) is not null then
    perform public.configure_streamcore_ai_autopilot_schedule(current_interval, current_active);
  end if;
exception when others then
  -- Preserve deployment if a legacy setting contains an unsupported value.
  perform public.configure_streamcore_ai_autopilot_schedule(10, current_active);
  update public.integration_settings
  set setting_value = current_config || jsonb_build_object('intervalMinutes', 10),
      updated_at = now()
  where setting_name = 'ai_autopilot';
end;
$$;
