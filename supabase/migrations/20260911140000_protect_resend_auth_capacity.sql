-- Reserve the Resend allowance for Supabase Auth verification emails and
-- direct member notifications. Mass community activity remains in-app.
insert into public.integration_settings (setting_name, setting_value, updated_at)
values (
  'resend_notifications',
  jsonb_build_object(
    'fromEmail', 'StreamCore Alerts <noreply@authenticcommunity.fun>',
    'notifyNewAnnouncement', false,
    'notifyRepliesAndMentions', true,
    'notifyNewClips', false,
    'notifyStreamerLive', false
  ),
  now()
)
on conflict (setting_name) do update
set setting_value = coalesce(public.integration_settings.setting_value, '{}'::jsonb)
  || jsonb_build_object(
    'notifyNewAnnouncement', false,
    'notifyNewClips', false,
    'notifyStreamerLive', false
  ),
  updated_at = now();
