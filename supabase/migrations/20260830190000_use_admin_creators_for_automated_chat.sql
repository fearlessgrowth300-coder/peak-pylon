-- Admin-created profiles live in community_listed_members. Self-signups only
-- live in profiles, so this marker and trigger keep automated chat authorship
-- restricted to the explicit admin-managed creator pool.
update public.community_listed_members
set data = data || jsonb_build_object('managedByAdmin', true)
where coalesce((data->>'managedByAdmin')::boolean, false) = false;

create or replace function public.assign_admin_creator_to_automated_post()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  creator_id text;
begin
  if coalesce((new.data->>'aiGenerated')::boolean, false) then
    select listed.id::text
    into creator_id
    from public.community_listed_members as listed
    where coalesce((listed.data->>'managedByAdmin')::boolean, false)
      and coalesce(listed.data->>'name', '') <> ''
      and coalesce(listed.data->>'role', 'streamer') not in ('admin', 'ai')
    order by random()
    limit 1;

    if creator_id is null then
      raise exception 'No admin-managed creator is available for automated chat';
    end if;

    new.data := jsonb_set(new.data, '{authorId}', to_jsonb(creator_id), true);
  end if;

  return new;
end;
$$;

drop trigger if exists assign_admin_creator_to_automated_post on public.community_posts;
create trigger assign_admin_creator_to_automated_post
before insert on public.community_posts
for each row
execute function public.assign_admin_creator_to_automated_post();

revoke all on function public.assign_admin_creator_to_automated_post() from public, anon, authenticated;
