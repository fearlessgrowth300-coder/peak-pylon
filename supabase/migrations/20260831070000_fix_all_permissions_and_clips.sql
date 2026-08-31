-- Restore only the minimum browser permissions required by the real community
-- UI. Row-level policies remain the authorization boundary; anonymous callers
-- must never receive write or SECURITY DEFINER execution rights.

revoke all on table public.integration_settings from anon, authenticated;
grant select on table public.integration_settings to anon, authenticated;
grant insert, update, delete on table public.integration_settings to authenticated;
grant all on table public.integration_settings to service_role;
alter table public.integration_settings enable row level security;

drop policy if exists "Allow read write integration_settings" on public.integration_settings;
drop policy if exists "Public integration settings are readable" on public.integration_settings;
drop policy if exists "Admins manage integration settings" on public.integration_settings;

create policy "Public integration settings are readable"
  on public.integration_settings for select using (true);

create policy "Admins manage integration settings"
  on public.integration_settings for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

revoke execute on function public.run_streamcore_ai_autopilot(boolean) from public, anon, authenticated;
grant execute on function public.run_streamcore_ai_autopilot(boolean) to service_role;

revoke all on table public.pv_tokens from anon, authenticated;
grant select on table public.pv_tokens to authenticated;
grant all on table public.pv_tokens to service_role;

revoke all on table public.community_posts from anon, authenticated;
grant select on table public.community_posts to anon, authenticated;
grant insert, update, delete on table public.community_posts to authenticated;
grant all on table public.community_posts to service_role;

revoke all on table public.community_listed_members from anon, authenticated;
grant select on table public.community_listed_members to anon, authenticated;
grant insert, update, delete on table public.community_listed_members to authenticated;
grant all on table public.community_listed_members to service_role;
