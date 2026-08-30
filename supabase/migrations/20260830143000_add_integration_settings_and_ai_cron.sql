-- Shared server-side integration settings, Twitch snapshots, and the real
-- StreamCore AI scheduler. Browser roles cannot read either integration table.
create table if not exists public.integration_settings (
  setting_name text primary key,
  setting_value jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.integration_settings enable row level security;
revoke all on table public.integration_settings from anon, authenticated;
grant all on table public.integration_settings to service_role;

insert into public.integration_settings (setting_name, setting_value)
values (
  'ai_autopilot',
  jsonb_build_object(
    'active', false,
    'intervalMinutes', 10,
    'channel', 'general',
    'stickers', true,
    'liveContext', true,
    'model', 'gemini-3.5-flash-lite',
    'keyCursor', 0,
    'lastRunAt', null,
    'lastStatus', 'Stopped',
    'lastError', null
  )
)
on conflict (setting_name) do nothing;

create extension if not exists http with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

create or replace function public.run_streamcore_ai_autopilot(force_run boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  config jsonb;
  keys jsonb;
  legacy_key text;
  api_key text;
  model_name text;
  channel_name text;
  key_index integer;
  key_count integer;
  interval_minutes integer;
  last_run_at timestamptz;
  now_ms bigint;
  live_context text;
  chat_context text;
  prompt_text text;
  request_body jsonb;
  response extensions.http_response;
  response_json jsonb;
  generated_text text;
  sticker_url text := '';
  post_id uuid;
begin
  select setting_value into config
  from public.integration_settings
  where setting_name = 'ai_autopilot';

  config := coalesce(config, '{}'::jsonb);
  if not force_run and not coalesce((config->>'active')::boolean, false) then
    return jsonb_build_object('created', false, 'status', 'stopped');
  end if;

  interval_minutes := greatest(5, least(60, coalesce((config->>'intervalMinutes')::integer, 10)));
  if nullif(config->>'lastRunAt', '') is not null then
    last_run_at := (config->>'lastRunAt')::timestamptz;
  end if;
  if not force_run and last_run_at is not null and last_run_at > now() - make_interval(mins => interval_minutes) then
    return jsonb_build_object('created', false, 'status', 'not_due');
  end if;

  begin
    select secret_value::jsonb into keys
    from public.integration_secrets
    where secret_name = 'gemini_api_keys';
  exception when others then
    keys := '[]'::jsonb;
  end;
  keys := coalesce(keys, '[]'::jsonb);
  if jsonb_typeof(keys) <> 'array' then keys := '[]'::jsonb; end if;

  if jsonb_array_length(keys) = 0 then
    select secret_value into legacy_key
    from public.integration_secrets
    where secret_name = 'gemini_api_key';
    if coalesce(legacy_key, '') <> '' then keys := jsonb_build_array(legacy_key); end if;
  end if;
  if jsonb_array_length(keys) = 0 then
    update public.integration_settings
    set setting_value = config || jsonb_build_object('lastStatus', 'Needs Gemini key', 'lastError', 'No Gemini API key is configured'),
        updated_at = now()
    where setting_name = 'ai_autopilot';
    return jsonb_build_object('created', false, 'status', 'not_configured');
  end if;

  model_name := coalesce(nullif(config->>'model', ''), 'gemini-3.5-flash-lite');
  if model_name not in ('gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-pro-preview') then
    model_name := 'gemini-3.5-flash-lite';
  end if;
  channel_name := coalesce(nullif(config->>'channel', ''), 'general');
  key_count := jsonb_array_length(keys);
  key_index := mod(greatest(0, coalesce((config->>'keyCursor')::integer, 0)), key_count);
  api_key := keys->>key_index;

  if coalesce((config->>'liveContext')::boolean, true) then
    select string_agg(
      coalesce(data->>'name', 'Creator') || ' is live in ' || coalesce(nullif(data->>'gameName', ''), 'their channel') ||
      case when coalesce(data->>'streamTitle', '') <> '' then ' — ' || (data->>'streamTitle') else '' end,
      E'\n'
    ) into live_context
    from public.community_listed_members
    where data->>'status' = 'live';
  end if;

  select string_agg(line, E'\n' order by post_time) into chat_context
  from (
    select
      coalesce(data->>'authorId', 'member') || ': ' || left(coalesce(data->>'text', ''), 300) as line,
      created_at as post_time
    from public.community_posts
    where data->>'channel' = channel_name
    order by created_at desc
    limit 10
  ) recent;

  prompt_text := 'You are StreamCore AI, the clearly labelled AI host in a real streamer community. '
    || 'Write exactly one natural Discord-style message of at most 45 words. Never pretend to be a listed creator. '
    || 'Never invent viewer counts, personal facts, events, scores, giveaways, or links. '
    || 'Use the supplied real context to ask a helpful streaming question, welcome discussion, or mention a confirmed live creator.'
    || E'\n\nConfirmed live context:\n' || coalesce(nullif(live_context, ''), 'No connected creator is currently confirmed live.')
    || E'\n\nRecent chat:\n' || coalesce(nullif(chat_context, ''), 'No recent messages.');

  request_body := jsonb_build_object(
    'contents', jsonb_build_array(jsonb_build_object('parts', jsonb_build_array(jsonb_build_object('text', prompt_text)))),
    'generationConfig', jsonb_build_object('temperature', 0.8, 'maxOutputTokens', 120)
  );

  update public.integration_settings
  set setting_value = config || jsonb_build_object('lastStatus', 'Running', 'lastError', null), updated_at = now()
  where setting_name = 'ai_autopilot';

  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS', '15000');
  response := extensions.http((
    'POST',
    'https://generativelanguage.googleapis.com/v1beta/models/' || model_name || ':generateContent',
    array[
      extensions.http_header('Content-Type', 'application/json'),
      extensions.http_header('x-goog-api-key', api_key)
    ],
    'application/json',
    request_body::text
  )::extensions.http_request);

  if response.status < 200 or response.status >= 300 then
    update public.integration_settings
    set setting_value = config || jsonb_build_object(
      'keyCursor', mod(key_index + 1, key_count),
      'lastStatus', 'Provider error',
      'lastError', 'Gemini HTTP ' || response.status::text
    ), updated_at = now()
    where setting_name = 'ai_autopilot';
    return jsonb_build_object('created', false, 'status', 'provider_error', 'httpStatus', response.status);
  end if;

  response_json := response.content::jsonb;
  generated_text := coalesce(response_json->'candidates'->0->'content'->'parts'->0->>'text', '');
  generated_text := regexp_replace(generated_text, 'https?://[^[:space:]]+', '', 'gi');
  generated_text := left(trim(regexp_replace(generated_text, '[[:space:]]+', ' ', 'g')), 420);
  if generated_text = '' then
    update public.integration_settings
    set setting_value = config || jsonb_build_object('lastStatus', 'Empty response', 'lastError', 'Gemini returned no text'), updated_at = now()
    where setting_name = 'ai_autopilot';
    return jsonb_build_object('created', false, 'status', 'empty_response');
  end if;

  if coalesce((config->>'stickers')::boolean, true) and random() < 0.20 then
    sticker_url := (array[
      'https://media.giphy.com/media/artj92V8o75VPL7AeQ/giphy.gif',
      'https://media.giphy.com/media/3o7TKSjRrfIPjeiVyM/giphy.gif',
      'https://media.giphy.com/media/d2Z4NRCUxsxZBvag/giphy.gif'
    ])[1 + floor(random() * 3)::integer];
  end if;

  post_id := gen_random_uuid();
  now_ms := (extract(epoch from clock_timestamp()) * 1000)::bigint;
  insert into public.community_posts (id, data)
  values (
    post_id,
    jsonb_build_object(
      'authorId', 'streamcore-ai',
      'text', generated_text,
      'image', '',
      'sticker', sticker_url,
      'channel', channel_name,
      'reactions', '{}'::jsonb,
      'likes', '[]'::jsonb,
      'shares', 0,
      'comments', '[]'::jsonb,
      'aiGenerated', true,
      'time', now_ms
    )
  );

  update public.integration_settings
  set setting_value = config || jsonb_build_object(
    'keyCursor', mod(key_index + 1, key_count),
    'lastRunAt', now()::text,
    'lastStatus', 'Message posted',
    'lastError', null
  ), updated_at = now()
  where setting_name = 'ai_autopilot';

  return jsonb_build_object('created', true, 'status', 'posted', 'postId', post_id, 'model', model_name);
exception when others then
  update public.integration_settings
  set setting_value = coalesce(config, '{}'::jsonb) || jsonb_build_object('lastStatus', 'Error', 'lastError', left(sqlerrm, 240)), updated_at = now()
  where setting_name = 'ai_autopilot';
  return jsonb_build_object('created', false, 'status', 'error', 'error', left(sqlerrm, 240));
end;
$$;

revoke all on function public.run_streamcore_ai_autopilot(boolean) from public, anon, authenticated;

select cron.schedule(
  'streamcore-ai-autopilot',
  '*/5 * * * *',
  $cron$select public.run_streamcore_ai_autopilot(false);$cron$
);
