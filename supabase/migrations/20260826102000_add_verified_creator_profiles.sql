ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS twitch_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS social_links jsonb NOT NULL DEFAULT '[]'::jsonb;
