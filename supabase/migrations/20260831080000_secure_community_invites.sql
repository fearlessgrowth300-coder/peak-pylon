-- Community invite links are public to read, but only the owner/admin can
-- create them. Authenticated invitees may claim a pending code only for their
-- own account.
revoke all on table public.community_invites from anon, authenticated;
grant select on table public.community_invites to anon, authenticated;
grant insert, update on table public.community_invites to authenticated;
grant all on table public.community_invites to service_role;

drop policy if exists "Authenticated users can create invites" on public.community_invites;
drop policy if exists "Admins and inviters can update invites" on public.community_invites;

create policy "Admins create community invites"
  on public.community_invites
  for insert
  to authenticated
  with check (public.has_role(auth.uid(), 'admin'));

create policy "Admins update community invites"
  on public.community_invites
  for update
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy "Invitees claim pending community invites"
  on public.community_invites
  for update
  to authenticated
  using (status = 'pending')
  with check (invited_creator_id = auth.uid()::text and status in ('joined', 'approved'));

create or replace function public.create_community_invite(
  p_inviter_id text,
  p_inviter_name text,
  p_inviter_handle text,
  p_campaign text default 'direct'
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  new_code text;
  chars text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  i integer;
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'admin') then
    raise exception 'Only a StreamCore admin can create invite links';
  end if;

  if p_inviter_id <> auth.uid()::text then
    raise exception 'Invite owner does not match the authenticated admin';
  end if;

  loop
    new_code := 'SC-';
    for i in 1..5 loop
      new_code := new_code || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    end loop;
    exit when not exists (select 1 from public.community_invites where code = new_code);
  end loop;

  insert into public.community_invites (
    code, inviter_id, inviter_name, inviter_handle, campaign, status
  ) values (
    new_code,
    auth.uid()::text,
    p_inviter_name,
    p_inviter_handle,
    coalesce(nullif(p_campaign, ''), 'direct'),
    'pending'
  );

  return new_code;
end;
$$;

revoke execute on function public.create_community_invite(text, text, text, text) from public, anon;
grant execute on function public.create_community_invite(text, text, text, text) to authenticated, service_role;
