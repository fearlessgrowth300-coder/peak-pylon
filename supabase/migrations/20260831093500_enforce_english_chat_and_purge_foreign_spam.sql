-- Enforce 100% English chat mandate and update AI prompt

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
  interval_sec numeric;
  last_run_text text;
  last_run_epoch double precision;
  live_context text := '';
  chat_context text := '';
  recent_phrases text := '';
  chosen_author_id text;
  creator_name text;
  creator_handle text;
  creator_bio text;
  creator_game text;
  creator_platform text;
  creator_stream_title text;
  creator_is_live boolean := false;
  latest_post_id uuid;
  latest_author_name text;
  latest_author_id text;
  latest_post_text text;
  should_reply boolean := false;
  reply_target_id uuid := null;
  prompt_text text;
  request_body jsonb;
  response extensions.http_response;
  response_json jsonb;
  generated_text text;
  sticker_url text := '';
  post_id uuid;
  now_ms bigint;
  stickers_all text[];
begin
  select setting_value into config
  from public.integration_settings
  where setting_name = 'ai_autopilot';

  config := coalesce(config, '{}'::jsonb);

  if not force_run and not coalesce((config->>'active')::boolean, false) then
    return jsonb_build_object('created', false, 'status', 'inactive');
  end if;

  interval_sec := greatest(5.0, coalesce((config->>'intervalMinutes')::numeric, 10.0) * 60.0);
  last_run_text := config->>'lastRunAt';
  if not force_run and last_run_text is not null and last_run_text <> '' then
    begin
      last_run_epoch := extract(epoch from last_run_text::timestamptz);
      if (extract(epoch from clock_timestamp()) - last_run_epoch) < (interval_sec - 1.5) then
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

  -- 1. Identify the most recent message in the channel for direct reply
  select
    cp.id,
    coalesce(m.data->>'name', p.display_name, 'Member'),
    cp.data->>'authorId',
    left(coalesce(cp.data->>'text', ''), 200)
  into
    latest_post_id,
    latest_author_name,
    latest_author_id,
    latest_post_text
  from public.community_posts cp
  left join public.community_listed_members m on m.id = cp.data->>'authorId'
  left join public.profiles p on p.id = cp.data->>'authorId'
  where cp.data->>'channel' = channel_name
    and coalesce(cp.data->>'text', '') <> ''
  order by cp.created_at desc
  limit 1;

  -- 2. Select a speaker (excluding the author of the last message)
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
  where (coalesce((data->>'managedByAdmin')::boolean, false) = true or coalesce(data->>'role', '') in ('admin', 'partner', 'streamer'))
    and id <> coalesce(latest_author_id, 'none')
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
    return jsonb_build_object('created', false, 'status', 'no_members');
  end if;

  -- 3. Gather live context
  if coalesce((config->>'liveContext')::boolean, true) then
    select coalesce(
      string_agg(
        data->>'name' || ' (@' || replace(coalesce(data->>'handle', ''), '@', '') || ') is streaming ' || coalesce(nullif(data->>'gameName', ''), 'Gaming') || ' ("' || left(coalesce(nullif(data->>'streamTitle', ''), 'Live Stream'), 60) || '")',
        E'\n'
      ),
      ''
    ) into live_context
    from public.community_listed_members
    where data->>'status' = 'live';
  end if;

  -- 4. Gather recent chat history
  select
    string_agg(author_name || ': "' || post_text || '"', E'\n' order by post_time asc),
    string_agg('"' || post_text || '"', E', ')
  into chat_context, recent_phrases
  from (
    select
      coalesce(m.data->>'name', p.display_name, 'Member') as author_name,
      left(coalesce(cp.data->>'text', ''), 180) as post_text,
      cp.created_at as post_time
    from public.community_posts cp
    left join public.community_listed_members m on m.id = cp.data->>'authorId'
    left join public.profiles p on p.id = cp.data->>'authorId'
    where cp.data->>'channel' = channel_name
      and coalesce(cp.data->>'text', '') <> ''
    order by cp.created_at desc
    limit 8
  ) recent;

  -- 5. Determine whether to reply directly or start fresh thought
  if latest_post_id is not null and latest_post_text <> '' and random() < 0.75 then
    should_reply := true;
    reply_target_id := latest_post_id;
  end if;

  -- 6. Conversational prompt with STRICT ENGLISH MANDATE
  prompt_text := 'You are ' || creator_name || ' (' || creator_handle || '), an authentic gamer and streamer chatting in a Discord community.'
    || E'\n\nYOUR PROFILE:'
    || E'\n- Name: ' || creator_name
    || E'\n- Main Game: ' || creator_game
    || E'\n- Status: ' || case when creator_is_live then 'Streaming live' else 'Offline' end
    || E'\n\nRECENT CHAT HISTORY:\n' || coalesce(nullif(chat_context, ''), 'Quiet chat.')
    || case when should_reply then E'\n\nTASK: ' || latest_author_name || ' just posted: "' || latest_post_text || '". Write a direct reply to ' || latest_author_name || ' (agree, banter, tease, or give your take).'
            else E'\n\nTASK: Share a fresh, casual streamer thought or question (gaming grind, stream plans, energy drinks, setup, or clutch matches).' end
    || E'\n\nCRITICAL LANGUAGE & CONTENT RULES:'
    || E'\n1. ALWAYS WRITE IN 100% NATURAL ENGLISH. NEVER USE CHINESE, JAPANESE, KOREAN, OR ANY NON-ENGLISH CHARACTERS UNDER ANY CIRCUMSTANCES.'
    || E'\n2. Even if previous messages or names contain non-English characters, YOU MUST RESPOND EXCLUSIVELY IN ENGLISH.'
    || E'\n3. DO NOT REPEAT ANY of these recent phrases: ' || coalesce(nullif(recent_phrases, ''), 'None')
    || E'\n4. NEVER use repetitive template phrases like "With all the action...", "Moving over to...", or "Shifting gears to...".'
    || E'\n5. NEVER say "StreamCore AI", "As an AI", or bot terms.'
    || E'\n6. NEVER start with "Hey everyone!".'
    || E'\n7. Keep it punchy (10 to 22 words max). Sound like a real streamer typing in Discord with natural gamer phrasing (fr, bro, gg, clutch, trolling, hop on, no way).';

  request_body := jsonb_build_object(
    'contents', jsonb_build_array(jsonb_build_object('parts', jsonb_build_array(jsonb_build_object('text', prompt_text)))),
    'generationConfig', jsonb_build_object('temperature', 0.92, 'maxOutputTokens', 80)
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
  generated_text := regexp_replace(generated_text, '\[?StreamCore AI[^\]]*\]?[:\s\-]*', '', 'gi');
  generated_text := regexp_replace(generated_text, 'As an AI[^:.]*[:.]\s*', '', 'gi');
  generated_text := regexp_replace(generated_text, '^Hey everyone!?\s*', '', 'gi');
  generated_text := trim(generated_text);

  if generated_text = '' then
    generated_text := 'Anyone grinding ranked games later today? Let me know who is down to queue.';
  end if;

  -- 7. 73 Real Contextual Stickers Pool
  stickers_all := array[
    'https://media.giphy.com/media/unQ3IJU2RG7DO/giphy.gif',
    'https://media.giphy.com/media/jpbnoe3UIa8TU8LM13/giphy.gif',
    'https://media.giphy.com/media/blSTtZehjAZ8I/giphy.gif',
    'https://media.giphy.com/media/Ju7l5y9osyymQ/giphy.gif',
    'https://media.giphy.com/media/l41lI4bYmcsPJX9Go/giphy.gif',
    'https://media.giphy.com/media/g9582DNuQppxC/giphy.gif',
    'https://media.giphy.com/media/3o7TKSjRrfIPjeiVyM/giphy.gif',
    'https://media.giphy.com/media/artj92V8o75VPL7AeQ/giphy.gif',
    'https://media.giphy.com/media/xT5LMHxhOfscxPfIfm/giphy.gif',
    'https://media.giphy.com/media/3oKIPnAiaMCws8nOsE/giphy.gif',
    'https://media.giphy.com/media/ICOgUNjpvO0PC/giphy.gif',
    'https://media.giphy.com/media/10JhviFuU2gWD6/giphy.gif',
    'https://media.giphy.com/media/26FPqAH61G4Cc3fZmM/giphy.gif',
    'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif',
    'https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif'
  ];

  if coalesce((config->>'stickers')::boolean, true) and (random() < 0.28 or generated_text ~* '(cat|jam|pepe|pog|hype|lol|lmao|gg|clutch|dance|vibe|party|ggs)') then
    sticker_url := stickers_all[1 + floor(random() * array_length(stickers_all, 1))::integer];
  end if;

  post_id := gen_random_uuid();
  now_ms := (extract(epoch from clock_timestamp()) * 1000)::bigint;

  insert into public.community_posts (id, data, created_at)
  values (
    post_id,
    jsonb_build_object(
      'id', post_id::text,
      'authorId', chosen_author_id,
      'channel', channel_name,
      'text', generated_text,
      'sticker', sticker_url,
      'replyToId', case when should_reply then reply_target_id::text else null end,
      'reactions', case when random() < 0.3 then jsonb_build_object('❤️', 1 + floor(random() * 2)::integer) else '{}'::jsonb end,
      'time', now_ms
    ),
    clock_timestamp()
  );

  update public.integration_settings
  set setting_value = config || jsonb_build_object(
    'keyCursor', mod(key_index + 1, key_count),
    'lastStatus', 'Running',
    'lastRunAt', now()::text,
    'lastError', null
  ), updated_at = now()
  where setting_name = 'ai_autopilot';

  return jsonb_build_object(
    'created', true,
    'postId', post_id,
    'authorId', chosen_author_id,
    'text', generated_text,
    'channel', channel_name,
    'replyToId', case when should_reply then reply_target_id::text else null end,
    'model', model_name
  );
end;
$$;

grant execute on function public.run_streamcore_ai_autopilot(boolean) to anon, authenticated, service_role;
