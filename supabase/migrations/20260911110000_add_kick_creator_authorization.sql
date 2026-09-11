alter table public.profiles
  add column if not exists kick_verified boolean not null default false,
  add column if not exists kick_authorized_at timestamptz,
  add column if not exists kick_user_id text;

create or replace function public.protect_profile_onboarding_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  trusted boolean := coalesce(auth.role() = 'service_role', false)
    or coalesce(public.has_role(auth.uid(), 'admin'), false);
begin
  if tg_op = 'INSERT' and not trusted then
    new.rules_acknowledged := false;
    new.channel_authorized := false;
    new.twitch_verified := false;
    new.kick_verified := false;
    new.rules_acknowledged_at := null;
    new.twitch_authorized_at := null;
    new.kick_authorized_at := null;
    new.twitch_user_id := null;
    new.kick_user_id := null;
    new.social_links := '[]'::jsonb;
  elsif tg_op = 'UPDATE' and not trusted and (
    new.rules_acknowledged is distinct from old.rules_acknowledged
    or new.channel_authorized is distinct from old.channel_authorized
    or new.twitch_verified is distinct from old.twitch_verified
    or new.kick_verified is distinct from old.kick_verified
    or new.rules_acknowledged_at is distinct from old.rules_acknowledged_at
    or new.twitch_authorized_at is distinct from old.twitch_authorized_at
    or new.kick_authorized_at is distinct from old.kick_authorized_at
    or new.twitch_user_id is distinct from old.twitch_user_id
    or new.kick_user_id is distinct from old.kick_user_id
    or new.social_links is distinct from old.social_links
  ) then
    raise exception 'Onboarding verification fields can only be changed by the secure server';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_onboarding_fields_trigger on public.profiles;
create trigger protect_profile_onboarding_fields_trigger
before insert or update on public.profiles
for each row execute function public.protect_profile_onboarding_fields();

revoke all on function public.protect_profile_onboarding_fields() from public;
