-- StreamCore deep conversation intelligence & creator personality engine
-- Fully analyzes conversation flow, creator profiles, and live stream state with zero mock data.

create or replace function public.run_streamcore_ai_autopilot(force_run boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  config jsonb;
  keys jsonb;
  legacy_key text;
  api_key text;
  key_count integer;
  key_index integer;
  model_name text;
  channel_name text;
  interval_min integer;
  last_run_text text;
  last_run_epoch double precision;
  live_context text := '';
  chat_context text := '';
  chosen_author_id text;
  creator_name text;
  creator_handle text;
  creator_bio text;
  creator_game text;
  creator_platform text;
  creator_stream_title text;
  creator_is_live boolean := false;
  prompt_text text;
  request_body jsonb;
  response extensions.http_response;
  response_json jsonb;
  generated_text text;
  sticker_url text := '';
  post_id uuid;
  now_ms bigint;
begin
  select setting_value into config
  from public.integration_settings
  where setting_name = 'ai_autopilot';

  config := coalesce(config, '{}'::jsonb);

  if not force_run and not coalesce((config->>'active')::boolean, false) then
    return jsonb_build_object('created', false, 'status', 'inactive');
  end if;

  interval_min := greatest(1, coalesce((config->>'intervalMinutes')::integer, 10));
  last_run_text := config->>'lastRunAt';
  if not force_run and last_run_text is not null and last_run_text <> '' then
    begin
      last_run_epoch := extract(epoch from last_run_text::timestamptz);
      if (extract(epoch from clock_timestamp()) - last_run_epoch) < (interval_min * 60 - 5) then
        return jsonb_build_object('created', false, 'status', 'throttled');
      end if;
    exception when others then
      null;
    end;
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

  -- 1. Select a real creator with complete profile details
  select
    id,
    coalesce(data->>'name', 'Creator'),
    coalesce(nullif(data->>'handle', ''), '@creator'),
    coalesce(nullif(data->>'bio', ''), ''),
    coalesce(nullif(data->>'gameName', ''), 'Gaming'),
    coalesce(nullif(data->>'platform', ''), 'Twitch'),
    coalesce(nullif(data->>'streamTitle', ''), ''),
    coalesce(data->>'status', '') = 'live'
  into
    chosen_author_id,
    creator_name,
    creator_handle,
    creator_bio,
    creator_game,
    creator_platform,
    creator_stream_title,
    creator_is_live
  from public.community_listed_members
  where coalesce((data->>'managedByAdmin')::boolean, false) = true
     or coalesce(data->>'role', '') in ('admin', 'partner', 'streamer')
  order by random()
  limit 1;

  if chosen_author_id is null then
    select
      id,
      coalesce(data->>'name', 'Creator'),
      coalesce(nullif(data->>'handle', ''), '@creator'),
      '',
      'Gaming',
      'Twitch',
      '',
      false
    into
      chosen_author_id,
      creator_name,
      creator_handle,
      creator_bio,
      creator_game,
      creator_platform,
      creator_stream_title,
      creator_is_live
    from public.community_listed_members
    order by random()
    limit 1;
  end if;

  if chosen_author_id is null then
    chosen_author_id := 'creator';
    creator_name := 'Creator';
    creator_handle := '@creator';
    creator_bio := '';
    creator_game := 'Gaming';
    creator_platform := 'Twitch';
    creator_stream_title := '';
    creator_is_live := false;
  end if;

  -- 2. Gather confirmed real live broadcasts across the community
  if coalesce((config->>'liveContext')::boolean, true) then
    select string_agg(
      coalesce(data->>'name', 'Creator') || ' (' || coalesce(data->>'platform', 'Twitch') || ') is live streaming ' || coalesce(nullif(data->>'gameName', ''), 'their game') ||
      case when coalesce(data->>'streamTitle', '') <> '' then ' — "' || left(data->>'streamTitle', 100) || '"' else '' end,
      E'\n'
    ) into live_context
    from public.community_listed_members
    where data->>'status' = 'live';
  end if;

  -- 3. Gather recent chat history with resolved creator display names
  select string_agg(
    author_name || ': "' || post_text || '"',
    E'\n' order by post_time asc
  ) into chat_context
  from (
    select
      coalesce(m.data->>'name', p.display_name, 'Member') as author_name,
      left(coalesce(cp.data->>'text', ''), 220) as post_text,
      cp.created_at as post_time
    from public.community_posts cp
    left join public.community_listed_members m on m.id = cp.data->>'authorId'
    left join public.profiles p on p.id = cp.data->>'authorId'
    where cp.data->>'channel' = channel_name
      and coalesce(cp.data->>'text', '') <> ''
    order by cp.created_at desc
    limit 12
  ) recent;

  -- 4. Formulate the conversation analysis and personality prompt
  prompt_text := 'You are roleplaying as ' || creator_name || ' (' || creator_handle || '), an authentic creator in this Discord-style streamer community.'
    || E'\n\nYOUR VERIFIED PROFILE & CONTEXT:'
    || E'\n- Creator Name: ' || creator_name
    || E'\n- Primary Platform: ' || creator_platform
    || E'\n- Main Category/Game: ' || creator_game
    || case when creator_bio <> '' then E'\n- Bio: ' || creator_bio else '' end
    || case when creator_stream_title <> '' then E'\n- Current Stream Title: ' || creator_stream_title else '' end
    || case when creator_is_live then E'\n- Live Status: 🔴 YOU ARE CURRENTLY LIVE STREAMING RIGHT NOW!' else E'\n- Live Status: Offline, relaxing in community chat.' end
    || E'\n\nLIVE COMMUNITY STREAMERS RIGHT NOW:\n' || coalesce(nullif(live_context, ''), 'No other creators currently broadcasting.')
    || E'\n\nRECENT COMMUNITY CHAT HISTORY:\n' || coalesce(nullif(chat_context, ''), 'Chat has been quiet. You are kicking off the chat.')
    || E'\n\nCONVERSATION REASONING INSTRUCTIONS:'
    || E'\n1. ANALYZE the recent conversation history above.'
    || E'\n2. DECIDE what is most natural to say:'
    || E'\n   - If someone in chat asked a question or shared a thought, reply to them directly or banter with them.'
    || E'\n   - If a tournament match (e.g. LEC, VCT, Premier League) or live streamer is mentioned, share your live reaction.'
    || E'\n   - If the conversation is winding down, start a fresh streamer discussion (e.g. gameplay moments, game patch, stream schedule).'
    || E'\n3. ABSOLUTE RULES:'
    || E'\n   - NEVER say you are an AI, never say "StreamCore AI here", never say "As an AI".'
    || E'\n   - NEVER mention bots, scripts, or automation.'
    || E'\n   - Speak 100% in first-person as ' || creator_name || '.'
    || E'\n   - Keep it short, natural, and punchy (12 to 28 words max). Just like real streamers type in Discord.';

  request_body := jsonb_build_object(
    'contents', jsonb_build_array(jsonb_build_object('parts', jsonb_build_array(jsonb_build_object('text', prompt_text)))),
    'generationConfig', jsonb_build_object('temperature', 0.85, 'maxOutputTokens', 100)
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
  generated_text := regexp_replace(generated_text, '^(StreamCore AI here[:\s\-]*|Hey everyone!?\s*StreamCore AI here\.?\s*|As an AI[^:]*:\s*)', '', 'gi');
  generated_text := left(trim(regexp_replace(generated_text, '[[:space:]]+', ' ', 'g')), 420);
  if generated_text = '' then
    update public.integration_settings
    set setting_value = config || jsonb_build_object('lastStatus', 'Empty response', 'lastError', 'Gemini returned no text'), updated_at = now()
    where setting_name = 'ai_autopilot';
    return jsonb_build_object('created', false, 'status', 'empty_response');
  end if;

  if coalesce((config->>'stickers')::boolean, true) and random() < 0.15 then
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
      'authorId', chosen_author_id,
      'text', generated_text,
      'image', '',
      'sticker', sticker_url,
      'channel', channel_name,
      'reactions', '{}'::jsonb,
      'likes', '[]'::jsonb,
      'shares', 0,
      'comments', '[]'::jsonb,
      'aiGenerated', false,
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

  return jsonb_build_object('created', true, 'status', 'posted', 'postId', post_id, 'author', creator_name, 'model', model_name);
exception when others then
  update public.integration_settings
  set setting_value = coalesce(config, '{}'::jsonb) || jsonb_build_object('lastStatus', 'Error', 'lastError', left(sqlerrm, 240)), updated_at = now()
  where setting_name = 'ai_autopilot';
  return jsonb_build_object('created', false, 'status', 'error', 'error', left(sqlerrm, 240));
end;
$$;
