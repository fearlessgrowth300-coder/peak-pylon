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
  bot_author_id text := 'streamcore_bot';
begin
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

  insert into public.community_posts (id, data)
  values (
    welcome_post_id,
    jsonb_build_object(
      'authorId', bot_author_id,
      'text', 'Welcome ' || coalesce(p_creator_handle, coalesce(p_creator_name, 'Creator')) || ' to StreamCore. Their channel has been verified by the admin team.' ||
        case when coalesce(p_channel_url, '') <> '' then E'\n\nChannel: ' || p_channel_url else '' end,
      'image', '',
      'sticker', '',
      'channel', 'general',
      'reactions', '{}'::jsonb,
      'likes', '[]'::jsonb,
      'shares', 0,
      'comments', '[]'::jsonb,
      'aiGenerated', false,
      'welcomeCreatorId', p_creator_id,
      'time', now_ms
    )
  );

  return jsonb_build_object('success', true, 'postId', welcome_post_id, 'replyCount', 0, 'botAuthorId', bot_author_id);
end;
$$;

revoke execute on function public.trigger_creator_welcome_burst(text, text, text, text) from public, anon, authenticated;
grant execute on function public.trigger_creator_welcome_burst(text, text, text, text) to service_role;
