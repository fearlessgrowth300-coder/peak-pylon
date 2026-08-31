-- Keep the left creator rail identical for administrators, members, and visitors.
-- These are the current real creator/profile IDs selected by the administrator.
insert into public.integration_settings (setting_name, setting_value, updated_at)
values (
  'community_pinned_streamers',
  '["5798d86c-dcc2-4176-ba81-1e63ba726da5","17a551aa-7512-4720-a958-71f54c7d9370","89e861b7-a381-4d57-a765-9d00cadec58e","a3e1bb45-7cb0-408e-8ae5-1ea69e57090c","44ba1937-1af5-4bff-bec3-655ffafe8598","5bbe1198-b078-468e-8230-b7aaf839118b","47de293d-e8eb-4afc-a98a-0012e7b0f5d7","94251a40-9736-4831-ac57-90bd9dc49de8","d6153298-b39a-4320-a10e-c34fbd686fb6"]'::jsonb,
  now()
)
on conflict (setting_name) do update
set setting_value = excluded.setting_value,
    updated_at = excluded.updated_at;
