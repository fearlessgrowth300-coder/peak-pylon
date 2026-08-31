-- Grant full permissions for integration_settings, community_posts, and AI autopilot to anon and authenticated

grant all on table public.integration_settings to anon, authenticated, service_role;
alter table public.integration_settings enable row level security;

drop policy if exists "Allow read write integration_settings" on public.integration_settings;
create policy "Allow read write integration_settings"
  on public.integration_settings
  for all
  using (true)
  with check (true);

grant execute on function public.run_streamcore_ai_autopilot(boolean) to anon, authenticated, service_role;
grant execute on function public.trigger_creator_welcome_burst(text, text, text, text) to anon, authenticated, service_role;
grant execute on function public.approve_creator_channel(text, text, text) to anon, authenticated, service_role;

grant all on table public.community_invites to anon, authenticated, service_role;
grant all on table public.pv_tokens to anon, authenticated, service_role;
grant all on table public.community_posts to anon, authenticated, service_role;
grant all on table public.community_listed_members to anon, authenticated, service_role;
