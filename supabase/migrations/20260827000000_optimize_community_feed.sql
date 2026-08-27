create index if not exists community_posts_created_at_desc_idx
  on public.community_posts (created_at desc);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'community_posts'
  ) then
    alter publication supabase_realtime add table public.community_posts;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'community_listed_members'
  ) then
    alter publication supabase_realtime add table public.community_listed_members;
  end if;
end
$$;
