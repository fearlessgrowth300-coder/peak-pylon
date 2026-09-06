create or replace function public.trigger_creator_welcome_burst(
  p_creator_id text,
  p_creator_name text,
  p_creator_handle text,
  p_channel_url text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  welcome_post_id uuid := gen_random_uuid();
  now_ms bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
  welcome_comments jsonb := '[]'::jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', gen_random_uuid()::text,
    'authorId', picked.id,
    'text', case picked.reply_number
      when 1 then 'Welcome to StreamCore ' || coalesce(p_creator_name, 'Creator') || '! Excited to catch your streams 🎉'
      when 2 then 'LFG! Welcome aboard ' || coalesce(p_creator_handle, '@creator') || ' 🚀'
      when 3 then 'Big warm welcome! Hit me up if you ever want to collaborate 🔥'
      when 4 then 'Welcome to the family! Dropped you a follow 💜'
      when 5 then 'What games or categories do you usually stream? 🎮'
      when 6 then 'Welcome creator! Let us grow together 🌟'
      when 7 then 'Drop your best stream clips in #clips when you are ready! 🎬'
      when 8 then 'Glad to have another passionate streamer here 🙌'
      when 9 then 'Welcome aboard! Check the creator resources in announcements.'
      when 10 then 'Looking forward to your next live session! 🔴'
      when 11 then 'Massive welcome ' || coalesce(p_creator_name, 'Creator') || '! ✨'
      else 'Great to have you in the StreamCore creator network! 👏'
    end,
    'time', now_ms + picked.reply_number * 3500
  ) order by picked.reply_number), '[]'::jsonb)
  into welcome_comments
  from (
    select creator.id, row_number() over ()::integer as reply_number
    from (
      select listed.id::text
      from public.community_listed_members listed
      where coalesce((listed.data->>'managedByAdmin')::boolean, false)
        and coalesce(listed.data->>'name', '') <> ''
        and coalesce(listed.data->>'role', 'streamer') not in ('admin', 'ai')
      order by random()
      limit 12
    ) creator
  ) picked;

  insert into public.community_posts (id, data)
  values (
    welcome_post_id,
    jsonb_build_object(
      'authorId', 'streamcore_bot',
      'text', '🎉 Everyone, welcome ' || coalesce(p_creator_name, 'Creator') || ' (' || coalesce(p_creator_handle, '@creator') || ') to StreamCore!' || E'\n\n' || 'Check out their channel: ' || coalesce(nullif(p_channel_url, ''), 'https://twitch.tv'),
      'image', '',
      'sticker', 'https://media.giphy.com/media/3o7TKSjRrfIPjeiVyM/giphy.gif',
      'channel', 'general',
      'reactions', jsonb_build_object('🔥', 8, '👏', 12, '🎉', 16, '🚀', 7),
      'likes', '[]'::jsonb,
      'shares', 0,
      'comments', welcome_comments,
      'aiGenerated', false,
      'welcomeCreatorId', p_creator_id,
      'time', now_ms
    )
  );

  return jsonb_build_object(
    'success', true,
    'postId', welcome_post_id,
    'replyCount', jsonb_array_length(welcome_comments)
  );
end;
$$;

revoke execute on function public.trigger_creator_welcome_burst(text, text, text, text) from public, anon, authenticated;
grant execute on function public.trigger_creator_welcome_burst(text, text, text, text) to service_role;

create or replace function public.approve_creator_channel(
  p_creator_id text,
  p_pv_token text,
  p_admin_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  creator_record record;
  was_authorized boolean := false;
  welcome_result jsonb := null;
begin
  if auth.uid() is null or auth.uid()::text <> p_admin_id or not public.has_role(auth.uid(), 'admin'::public.app_role) then
    return jsonb_build_object('success', false, 'error', 'Only an authenticated administrator can approve creator channels');
  end if;

  if coalesce(trim(p_pv_token), '') = '' then
    return jsonb_build_object('success', false, 'error', 'PV Token is required to approve channel');
  end if;

  select id, display_name, handle, channel_url, channel_authorized
  into creator_record
  from public.profiles
  where id::text = p_creator_id
  for update;

  if creator_record.id is null then
    return jsonb_build_object('success', false, 'error', 'Creator profile was not found');
  end if;

  was_authorized := coalesce(creator_record.channel_authorized, false);

  update public.profiles
  set approval_status = 'approved',
      pv_token = upper(trim(p_pv_token)),
      channel_authorized = true
  where id = creator_record.id;

  update public.community_invites
  set status = 'approved',
      pv_token = upper(trim(p_pv_token)),
      approved_at = now()
  where invited_creator_id::text = p_creator_id;

  update public.pv_tokens
  set status = 'used',
      creator_id = p_creator_id,
      used_at = now()
  where token = upper(trim(p_pv_token));

  if not was_authorized then
    welcome_result := public.trigger_creator_welcome_burst(
      p_creator_id,
      coalesce(creator_record.display_name, 'Creator'),
      coalesce(creator_record.handle, '@creator'),
      coalesce(creator_record.channel_url, 'https://twitch.tv')
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'creatorId', p_creator_id,
    'status', 'approved',
    'welcome', welcome_result
  );
end;
$$;

revoke execute on function public.approve_creator_channel(text, text, text) from public, anon;
grant execute on function public.approve_creator_channel(text, text, text) to authenticated, service_role;
