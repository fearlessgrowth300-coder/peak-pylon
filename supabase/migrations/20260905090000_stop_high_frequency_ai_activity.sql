-- Stop the high-frequency activity job before service is restored. The admin
-- can re-enable it from the control center at a safe 10+ minute interval.
do $$
begin
  begin
    perform cron.unschedule('streamcore-ai-autopilot');
  exception when others then
    null;
  end;

  update public.integration_settings
  set setting_value = coalesce(setting_value, '{}'::jsonb) || jsonb_build_object(
        'active', false,
        'intervalMinutes', 10,
        'lastStatus', 'Stopped to protect database bandwidth',
        'lastError', null
      ),
      updated_at = now()
  where setting_name = 'ai_autopilot';
end;
$$;

-- The database enforces the same safe choices as the control center. This
-- prevents an older browser build from restoring a seconds-based cron job.
create or replace function public.streamcore_ai_schedule_for_interval(interval_minutes numeric)
returns text
language plpgsql
immutable
strict
set search_path = public, pg_catalog
as $$
begin
  if interval_minutes = 10 then return '*/10 * * * *'; end if;
  if interval_minutes = 15 then return '*/15 * * * *'; end if;
  if interval_minutes = 30 then return '*/30 * * * *'; end if;
  if interval_minutes = 60 then return '0 * * * *'; end if;
  raise exception 'StreamCore activity interval must be at least 10 minutes';
end;
$$;

revoke all on function public.streamcore_ai_schedule_for_interval(numeric) from public, anon, authenticated;
grant execute on function public.streamcore_ai_schedule_for_interval(numeric) to service_role;
