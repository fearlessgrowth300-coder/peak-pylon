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
  bot_author_id text := 'streamcore_bot';
begin
  -- Prefer the real bot profile created and controlled by the admin. The
  -- built-in id is only a safe fallback until that profile exists.
  select listed.id::text
  into bot_author_id
  from public.community_listed_members listed
  where coalesce((listed.data->>'managedByAdmin')::boolean, false)
    and (
      lower(coalesce(listed.data->>'name', '')) in ('streamcore bot', 'streamcorebot')
      or lower(replace(coalesce(listed.data->>'handle', ''), '@', '')) in ('streamcore', 'streamcore_bot', 'streamcorebot')
    )
  order by listed.created_at asc
  limit 1;

  bot_author_id := coalesce(bot_author_id, 'streamcore_bot');

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
        and listed.id::text <> bot_author_id
      order by random()
      limit 12
    ) creator
  ) picked;

  insert into public.community_posts (id, data)
  values (
    welcome_post_id,
    jsonb_build_object(
      'authorId', bot_author_id,
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

  return jsonb_build_object('success', true, 'postId', welcome_post_id, 'replyCount', jsonb_array_length(welcome_comments), 'botAuthorId', bot_author_id);
end;
$$;

revoke execute on function public.trigger_creator_welcome_burst(text, text, text, text) from public, anon, authenticated;
grant execute on function public.trigger_creator_welcome_burst(text, text, text, text) to service_role;
