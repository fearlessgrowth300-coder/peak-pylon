CREATE TYPE public.app_role AS ENUM ('member','streamer','verified','affiliate','partner','moderator','admin');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT 'New creator',
  handle text UNIQUE,
  bio text NOT NULL DEFAULT '',
  avatar_url text NOT NULL DEFAULT '',
  banner_url text NOT NULL DEFAULT '',
  platform text NOT NULL DEFAULT 'Twitch',
  channel_url text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'online',
  is_banned boolean NOT NULL DEFAULT false,
  restricted_until timestamptz,
  last_active_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "Profiles are publicly viewable" ON public.profiles
  FOR SELECT USING (is_banned = false OR auth.uid() = id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins can update any profile" ON public.profiles
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins can delete profiles" ON public.profiles
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE POLICY "Roles are viewable" ON public.user_roles FOR SELECT USING (true);
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_first boolean;
BEGIN
  INSERT INTO public.profiles (id, display_name, handle, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1), 'New creator'),
    COALESCE(NEW.raw_user_meta_data->>'handle', '@' || split_part(NEW.email,'@',1) || '_' || substr(NEW.id::text,1,4)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  );

  SELECT COUNT(*) = 0 INTO is_first FROM public.user_roles;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN is_first THEN 'admin'::public.app_role ELSE 'streamer'::public.app_role END);

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();