-- 1. Create table for Community Invites
create table if not exists public.community_invites (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  inviter_id text not null,
  inviter_name text not null default '',
  inviter_handle text not null default '',
  campaign text not null default 'direct',
  status text not null default 'pending', -- 'pending', 'joined', 'approved', 'expired'
  invited_creator_id text,
  invited_creator_name text,
  invited_creator_handle text,
  invited_creator_channel text,
  pv_token text,
  created_at timestamptz not null default now(),
  joined_at timestamptz,
  approved_at timestamptz
);

-- Index for fast lookup by code and inviter
create index if not exists idx_community_invites_code on public.community_invites (code);
create index if not exists idx_community_invites_inviter on public.community_invites (inviter_id);

-- Enable RLS on community_invites
alter table public.community_invites enable row level security;

create policy "Invites are readable by everyone"
  on public.community_invites for select
  using (true);

create policy "Authenticated users can create invites"
  on public.community_invites for insert
  with check (auth.role() = 'authenticated');

create policy "Admins and inviters can update invites"
  on public.community_invites for update
  using (true);

-- 2. Add columns to public.profiles if not existing
alter table public.profiles
  add column if not exists channel_authorized boolean default false,
  add column if not exists channel_platform text default 'twitch',
  add column if not exists approval_status text default 'pending',
  add column if not exists pv_token text default '',
  add column if not exists invite_code_used text default '',
  add column if not exists inviter_id text default '',
  add column if not exists rules_acknowledged boolean default false,
  add column if not exists notifications_enabled boolean default false;

-- 3. Create table for PV Tokens
create table if not exists public.pv_tokens (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  assigned_to_invite text,
  creator_id text,
  issued_by text not null default 'admin',
  status text not null default 'available', -- 'available', 'used', 'revoked'
  created_at timestamptz not null default now(),
  used_at timestamptz
);

alter table public.pv_tokens enable row level security;

create policy "PV tokens readable by authenticated"
  on public.pv_tokens for select
  using (auth.role() = 'authenticated');

create policy "PV tokens manageable by admin"
  on public.pv_tokens for all
  using (true);

-- Insert default starter PV tokens
insert into public.pv_tokens (token, status)
values
  ('PV-8F42K-STREAM', 'available'),
  ('PV-9912A-CREATOR', 'available'),
  ('PV-7734X-VERIFIED', 'available'),
  ('PV-5521M-PARTNER', 'available')
on conflict (token) do nothing;

-- 4. Function to generate a new unique invite code
create or replace function public.create_community_invite(
  p_inviter_id text,
  p_inviter_name text,
  p_inviter_handle text,
  p_campaign text default 'direct'
)
returns text
language plpgsql
security definer
as $$
declare
  new_code text;
  chars text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  i integer;
begin
  loop
    new_code := 'SC-';
    for i in 1..5 loop
      new_code := new_code || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    end loop;
    exit when not exists (select 1 from public.community_invites where code = new_code);
  end loop;

  insert into public.community_invites (
    code,
    inviter_id,
    inviter_name,
    inviter_handle,
    campaign,
    status
  ) values (
    new_code,
    p_inviter_id,
    p_inviter_name,
    p_inviter_handle,
    coalesce(nullif(p_campaign, ''), 'direct'),
    'pending'
  );

  return new_code;
end;
$$;

-- 5. Function to trigger immediate Welcome Burst from Admin & Community Streamers
create or replace function public.trigger_creator_welcome_burst(
  p_creator_id text,
  p_creator_name text,
  p_creator_handle text,
  p_channel_url text
)
returns jsonb
language plpgsql
security definer
as $$
declare
  admin_id text;
  welcome_post_id uuid;
  reply_1_id uuid;
  reply_2_id uuid;
  reply_3_id uuid;
  now_ms bigint;
  streamer_1 record;
  streamer_2 record;
  streamer_3 record;
begin
  -- Find Admin Profile or Owner Member
  select id into admin_id
  from public.community_listed_members
  where coalesce(data->>'role', '') = 'admin'
  limit 1;

  if admin_id is null then
    select id into admin_id
    from public.profiles
    order by created_at asc
    limit 1;
  end if;

  if admin_id is null then
    admin_id := 'streamcore_admin';
  end if;

  now_ms := (extract(epoch from clock_timestamp()) * 1000)::bigint;
  welcome_post_id := gen_random_uuid();

  -- 1. Main Welcome Post by Admin Profile
  insert into public.community_posts (id, data)
  values (
    welcome_post_id,
    jsonb_build_object(
      'authorId', admin_id,
      'text', '🎉 Everyone let''s give a massive warm welcome to our newest creator ' || coalesce(p_creator_name, 'Creator') || ' (' || coalesce(p_creator_handle, '@creator') || ') to StreamCore! Check out their channel: ' || coalesce(p_channel_url, 'https://twitch.tv'),
      'image', '',
      'sticker', 'https://media.giphy.com/media/3o7TKSjRrfIPjeiVyM/giphy.gif', -- Confetti Celebrate
      'channel', 'general',
      'reactions', jsonb_build_object('🔥', 4, '👏', 5),
      'likes', jsonb_build_array(admin_id),
      'shares', 2,
      'comments', '[]'::jsonb,
      'aiGenerated', false,
      'time', now_ms
    )
  );

  -- 2. Pick 3 distinct verified streamers for immediate welcome replies
  select id, coalesce(data->>'name', 'Creator') as name into streamer_1
  from public.community_listed_members
  where (coalesce((data->>'managedByAdmin')::boolean, false) = true or coalesce(data->>'role', '') in ('admin', 'partner', 'streamer'))
    and id <> admin_id
  order by random()
  limit 1;

  select id, coalesce(data->>'name', 'Creator') as name into streamer_2
  from public.community_listed_members
  where (coalesce((data->>'managedByAdmin')::boolean, false) = true or coalesce(data->>'role', '') in ('admin', 'partner', 'streamer'))
    and id <> admin_id and id <> coalesce(streamer_1.id, '')
  order by random()
  limit 1;

  select id, coalesce(data->>'name', 'Creator') as name into streamer_3
  from public.community_listed_members
  where (coalesce((data->>'managedByAdmin')::boolean, false) = true or coalesce(data->>'role', '') in ('admin', 'partner', 'streamer'))
    and id <> admin_id and id <> coalesce(streamer_1.id, '') and id <> coalesce(streamer_2.id, '')
  order by random()
  limit 1;

  -- Reply 1 (Hype)
  if streamer_1.id is not null then
    reply_1_id := gen_random_uuid();
    insert into public.community_posts (id, data)
    values (
      reply_1_id,
      jsonb_build_object(
        'authorId', streamer_1.id,
        'text', 'welcome to the family ' || coalesce(p_creator_name, 'bro') || '! Glad to have you here 🔥',
        'image', '',
        'sticker', 'https://media.giphy.com/media/artj92V8o75VPL7AeQ/giphy.gif', -- Cat Jam Vibing
        'replyToId', welcome_post_id,
        'channel', 'general',
        'reactions', jsonb_build_object('🔥', 2),
        'likes', '[]'::jsonb,
        'shares', 0,
        'comments', '[]'::jsonb,
        'aiGenerated', false,
        'time', now_ms + 1200
      )
    );
  end if;

  -- Reply 2 (Question/Banter)
  if streamer_2.id is not null then
    reply_2_id := gen_random_uuid();
    insert into public.community_posts (id, data)
    values (
      reply_2_id,
      jsonb_build_object(
        'authorId', streamer_2.id,
        'text', 'yo welcome in ' || coalesce(p_creator_name, '') || '! What games do you stream the most?',
        'image', '',
        'sticker', 'https://media.giphy.com/media/WRQBXSCnEFJIuxktnw/giphy.gif', -- Pepe Hype
        'replyToId', welcome_post_id,
        'channel', 'general',
        'reactions', jsonb_build_object('🎮', 3),
        'likes', '[]'::jsonb,
        'shares', 0,
        'comments', '[]'::jsonb,
        'aiGenerated', false,
        'time', now_ms + 2500
      )
    );
  end if;

  -- Reply 3 (Celebration)
  if streamer_3.id is not null then
    reply_3_id := gen_random_uuid();
    insert into public.community_posts (id, data)
    values (
      reply_3_id,
      jsonb_build_object(
        'authorId', streamer_3.id,
        'text', 'big warm welcome ' || coalesce(p_creator_name, '') || '! Dropping a follow on your channel right now 🚀',
        'image', '',
        'sticker', 'https://media.giphy.com/media/g9582DNuQppxC/giphy.gif', -- Cheers Toast
        'replyToId', welcome_post_id,
        'channel', 'general',
        'reactions', jsonb_build_object('❤️', 3),
        'likes', '[]'::jsonb,
        'shares', 0,
        'comments', '[]'::jsonb,
        'aiGenerated', false,
        'time', now_ms + 4000
      )
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'welcomePostId', welcome_post_id,
    'creator', p_creator_name
  );
end;
$$;

-- 6. Function to approve creator channel with PV Token
create or replace function public.approve_creator_channel(
  p_creator_id text,
  p_pv_token text,
  p_admin_id text
)
returns jsonb
language plpgsql
security definer
as $$
declare
  token_record record;
  creator_email text;
  creator_name text;
begin
  -- Validate PV token format (e.g. PV-XXXX-XXXX or custom token string)
  if coalesce(p_pv_token, '') = '' then
    return jsonb_build_object('success', false, 'error', 'PV Token is required to approve channel');
  end if;

  -- Update creator profile to approved
  update public.profiles
  set
    approval_status = 'approved',
    pv_token = p_pv_token,
    channel_authorized = true
  where id = p_creator_id;

  -- Update associated invite
  update public.community_invites
  set
    status = 'approved',
    pv_token = p_pv_token,
    approved_at = now()
  where invited_creator_id = p_creator_id;

  -- Mark token as used if in pv_tokens table
  update public.pv_tokens
  set
    status = 'used',
    creator_id = p_creator_id,
    used_at = now()
  where token = p_pv_token;

  return jsonb_build_object(
    'success', true,
    'creatorId', p_creator_id,
    'status', 'approved'
  );
end;
$$;
