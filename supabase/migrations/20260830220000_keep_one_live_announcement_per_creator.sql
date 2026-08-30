-- Keep a single current Twitch live announcement per creator/channel.
-- When a creator announces a later stream, the previous live announcement is
-- replaced while ordinary conversation remains untouched.

delete from public.community_posts
where id in (
  select id
  from (
    select
      id,
      row_number() over (
        partition by data->>'authorId', coalesce(data->>'channel', 'general')
        order by created_at desc, id desc
      ) as duplicate_number
    from public.community_posts
    where lower(coalesce(data->>'text', '')) ~ '(i.?m|i am)[[:space:]]+live'
      and (
        lower(coalesce(data->>'text', '')) like '%twitch.tv/%'
        or lower(coalesce(data->>'text', '')) like '%on twitch%'
      )
  ) live_posts
  where duplicate_number > 1
);

create or replace function public.replace_previous_live_announcement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  incoming_text text := lower(coalesce(new.data->>'text', ''));
begin
  if incoming_text ~ '(i.?m|i am)[[:space:]]+live'
     and (incoming_text like '%twitch.tv/%' or incoming_text like '%on twitch%') then
    delete from public.community_posts existing
    where existing.id <> new.id
      and existing.data->>'authorId' = new.data->>'authorId'
      and coalesce(existing.data->>'channel', 'general') = coalesce(new.data->>'channel', 'general')
      and lower(coalesce(existing.data->>'text', '')) ~ '(i.?m|i am)[[:space:]]+live'
      and (
        lower(coalesce(existing.data->>'text', '')) like '%twitch.tv/%'
        or lower(coalesce(existing.data->>'text', '')) like '%on twitch%'
      );
  end if;
  return new;
end;
$$;

drop trigger if exists replace_previous_live_announcement_trigger on public.community_posts;
create trigger replace_previous_live_announcement_trigger
before insert or update of data on public.community_posts
for each row execute function public.replace_previous_live_announcement();

