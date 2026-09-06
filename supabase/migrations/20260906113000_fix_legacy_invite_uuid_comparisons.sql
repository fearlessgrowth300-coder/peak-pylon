-- Repair legacy invite functions that compared UUID columns with text values.

do $migration$
declare
  fn_oid oid;
  fn_body text;
begin
  select p.oid, p.prosrc into fn_oid, fn_body
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'trigger_creator_welcome_burst'
    and pg_get_function_identity_arguments(p.oid) = 'p_creator_id text, p_creator_name text, p_creator_handle text, p_channel_url text';

  if fn_oid is not null then
    fn_body := replace(fn_body, 'and id <> admin_id', 'and id::text <> admin_id');
    fn_body := replace(fn_body, 'and id <> coalesce(streamer_1.id, '''')', 'and id::text <> coalesce(streamer_1.id::text, '''')');
    fn_body := replace(fn_body, 'and id <> coalesce(streamer_2.id, '''')', 'and id::text <> coalesce(streamer_2.id::text, '''')');
    execute format(
      'create or replace function public.trigger_creator_welcome_burst(p_creator_id text, p_creator_name text, p_creator_handle text, p_channel_url text) returns jsonb language plpgsql security definer set search_path = public as %L',
      fn_body
    );
  end if;

  select p.oid, p.prosrc into fn_oid, fn_body
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'approve_creator_channel'
    and pg_get_function_identity_arguments(p.oid) = 'p_creator_id text, p_pv_token text, p_admin_id text';

  if fn_oid is not null then
    fn_body := replace(fn_body, 'where id = p_creator_id;', 'where id = p_creator_id::uuid;');
    execute format(
      'create or replace function public.approve_creator_channel(p_creator_id text, p_pv_token text, p_admin_id text) returns jsonb language plpgsql security definer set search_path = public as %L',
      fn_body
    );
  end if;
end;
$migration$;
