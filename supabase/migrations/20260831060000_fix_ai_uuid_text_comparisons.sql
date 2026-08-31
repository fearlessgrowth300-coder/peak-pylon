-- Community post author IDs are stored inside JSON as text, while member and
-- profile primary keys are UUIDs. Patch the current worker body so PostgreSQL
-- compares like types without replacing the newer conversation logic.

do $migration$
declare
  worker_body text;
  patched_body text;
begin
  select procedure_definition.prosrc
  into worker_body
  from pg_proc procedure_definition
  join pg_namespace procedure_schema on procedure_schema.oid = procedure_definition.pronamespace
  where procedure_schema.nspname = 'public'
    and procedure_definition.proname = 'run_streamcore_ai_autopilot'
    and procedure_definition.proargtypes = '16'::oidvector;

  if worker_body is null then
    raise exception 'run_streamcore_ai_autopilot(boolean) was not found';
  end if;

  patched_body := replace(
    worker_body,
    'm.id = cp.data->>''authorId''',
    'm.id::text = cp.data->>''authorId'''
  );
  patched_body := replace(
    patched_body,
    'p.id = cp.data->>''authorId''',
    'p.id::text = cp.data->>''authorId'''
  );
  patched_body := replace(
    patched_body,
    'and id <> coalesce(latest_author_id, ''none'')',
    'and id::text <> coalesce(latest_author_id, ''none'')'
  );

  if patched_body = worker_body then
    raise exception 'The expected UUID/text comparisons were not found in the AI worker';
  end if;

  execute format(
    'create or replace function public.run_streamcore_ai_autopilot(force_run boolean default false) returns jsonb language plpgsql security definer set search_path = public, extensions as %L',
    patched_body
  );
end;
$migration$;

revoke all on function public.run_streamcore_ai_autopilot(boolean) from public, anon, authenticated;
