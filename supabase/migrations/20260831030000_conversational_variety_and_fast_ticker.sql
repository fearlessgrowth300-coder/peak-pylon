-- Purge duplicate repeat messages and upgrade to true conversational threading
delete from public.community_posts
where id in (
  select id from (
    select id, row_number() over (
      partition by left(coalesce(data->>'text', ''), 60)
      order by created_at desc
    ) as rn
    from public.community_posts
    where coalesce(data->>'text', '') <> ''
  ) t
  where t.rn > 1
);

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
  interval_sec double precision;
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
  latest_author_name text := '';
  latest_author_id text := '';
  latest_post_text text := '';
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

  -- 2. Select a speaker (excluding the author of the last message so they don't talk to themselves)
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
    chosen_author_id := 'creator';
    creator_name := 'Creator';
    creator_handle := '@creator';
    creator_bio := '';
    creator_game := 'Gaming';
    creator_platform := 'Twitch';
    creator_stream_title := '';
    creator_is_live := false;
  end if;

  -- 3. Gather live broadcasts
  if coalesce((config->>'liveContext')::boolean, true) then
    select string_agg(
      coalesce(data->>'name', 'Creator') || ' (' || coalesce(data->>'platform', 'Twitch') || ') is live in ' || coalesce(nullif(data->>'gameName', ''), 'their stream'),
      E'\n'
    ) into live_context
    from public.community_listed_members
    where data->>'status' = 'live';
  end if;

  -- 4. Gather recent chat history and anti-repetition phrases
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
    limit 10
  ) recent;

  -- 5. Determine whether to reply directly or start fresh thought (75% reply if chat is active)
  if latest_post_id is not null and latest_post_text <> '' and random() < 0.75 then
    should_reply := true;
    reply_target_id := latest_post_id;
  end if;

  -- 6. Conversational prompt with strict uniqueness & reply instructions
  prompt_text := 'You are ' || creator_name || ' (' || creator_handle || '), an active streamer chilling in a Discord gaming community.'
    || E'\n\nYOUR PROFILE:'
    || E'\n- Name: ' || creator_name
    || E'\n- Main Game: ' || creator_game
    || E'\n- Status: ' || case when creator_is_live then 'Streaming live' else 'Offline' end
    || E'\n\nRECENT CHAT HISTORY:\n' || coalesce(nullif(chat_context, ''), 'Quiet chat.')
    || case when should_reply then E'\n\nTASK: ' || latest_author_name || ' just said: "' || latest_post_text || '". Write a direct, natural reply to ' || latest_author_name || ' (e.g. agree, banter, share your take, or tease them).'
            else E'\n\nTASK: Share a fresh, casual streamer thought or question (e.g. what games people are playing, your ranked grind, stream plans, or match thoughts).' end
    || E'\n\nSTRICT ANTI-REPETITION RULES:'
    || E'\n1. DO NOT REPEAT ANY of these recent phrases: ' || coalesce(nullif(recent_phrases, ''), 'None')
    || E'\n2. NEVER use repetitive template phrases like "With all the action happening..." or "Moving over to..." or "Shifting gears to...".'
    || E'\n3. NEVER say "StreamCore AI", "As an AI", or bot terms.'
    || E'\n4. NEVER start with "Hey everyone!".'
    || E'\n5. Keep it punchy and authentic (10 to 24 words max). Sound 100% like a real streamer typing in Discord.';

  request_body := jsonb_build_object(
    'contents', jsonb_build_array(jsonb_build_object('parts', jsonb_build_array(jsonb_build_object('text', prompt_text)))),
    'generationConfig', jsonb_build_object('temperature', 0.95, 'maxOutputTokens', 85)
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
  generated_text := regexp_replace(generated_text, '\[?StreamCore AI here\]?[:\s\-]*', '', 'gi');
  generated_text := regexp_replace(generated_text, '\[?StreamCore AI\]?[:\s\-]*', '', 'gi');
  generated_text := regexp_replace(generated_text, '^Hey everyone!?\s*', '', 'gi');
  generated_text := regexp_replace(generated_text, 'As an AI[^:.]*[:.]\s*', '', 'gi');
  generated_text := left(trim(regexp_replace(generated_text, '[[:space:]]+', ' ', 'g')), 420);

  if generated_text = '' then
    update public.integration_settings
    set setting_value = config || jsonb_build_object('lastStatus', 'Empty response', 'lastError', 'Gemini returned no text'), updated_at = now()
    where setting_name = 'ai_autopilot';
    return jsonb_build_object('created', false, 'status', 'empty_response');
  end if;

  -- 73 Diverse Community Stickers palette
  stickers_all := array[
    'https://media.giphy.com/media/artj92V8o75VPL7AeQ/giphy.gif',
    'https://media.giphy.com/media/WRQBXSCnEFJIuxktnw/giphy.gif',
    'https://media.giphy.com/media/blSTtZehjAZ8I/giphy.gif',
    'https://media.giphy.com/media/3o7TKSjRrfIPjeiVyM/giphy.gif',
    'https://media.giphy.com/media/l41YkxvU8c7J7Bba0/giphy.gif',
    'https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif',
    'https://media.giphy.com/media/ibolLe3mOqHE3PQTtk/giphy.gif',
    'https://media.giphy.com/media/xT0xezQGU5xCDJuCPe/giphy.gif',
    'https://media.giphy.com/media/26gsjCZpPolPr3sBy/giphy.gif',
    'https://media.giphy.com/media/3o72F8t9TDi2xVnxOE/giphy.gif',
    'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif',
    'https://media.giphy.com/media/d2Z4NRCUxsxZBvag/giphy.gif',
    'https://media.giphy.com/media/xT9IgzoKnwFNmISR8I/giphy.gif',
    'https://media.giphy.com/media/3oKIPnAiaMCws8nOsE/giphy.gif',
    'https://media.giphy.com/media/26n6WywJyh39n1pBu/giphy.gif',
    'https://media.giphy.com/media/l0HlBO7eyXzSZkJri/giphy.gif',
    'https://media.giphy.com/media/3o7TKMt1VVNkHV2PaE/giphy.gif',
    'https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif',
    'https://media.giphy.com/media/g9582DNuQppxC/giphy.gif',
    'https://media.giphy.com/media/Od0QRnzwRBYmDU3eEO/giphy.gif',
    'https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif',
    'https://media.giphy.com/media/l4pTfx2qLszoacZRS/giphy.gif',
    'https://media.giphy.com/media/l3q2K5jinAlChoCLS/giphy.gif',
    'https://media.giphy.com/media/d3mlE7uhX8KFgEmY/giphy.gif',
    'https://media.giphy.com/media/gl0mkIZOW6Nwc/giphy.gif',
    'https://media.giphy.com/media/26BRv0ThflsHCqDrG/giphy.gif',
    'https://media.giphy.com/media/26FLdmIp6wJr91JAI/giphy.gif',
    'https://media.giphy.com/media/13HgwGsXF0aiGY/giphy.gif',
    'https://media.giphy.com/media/3o7TKMGPU46K8EmEda/giphy.gif'
  ];

  if coalesce((config->>'stickers')::boolean, true) and random() < 0.22 then
    sticker_url := stickers_all[1 + floor(random() * array_length(stickers_all, 1))::integer];
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
      'replyToId', reply_target_id,
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

  return jsonb_build_object('created', true, 'status', 'posted', 'postId', post_id, 'author', creator_name, 'replyTo', latest_author_name, 'model', model_name);
exception when others then
  update public.integration_settings
  set setting_value = coalesce(config, '{}'::jsonb) || jsonb_build_object('lastStatus', 'Error', 'lastError', left(sqlerrm, 240)), updated_at = now()
  where setting_name = 'ai_autopilot';
  return jsonb_build_object('created', false, 'status', 'error', 'error', left(sqlerrm, 240));
end;
$$;
