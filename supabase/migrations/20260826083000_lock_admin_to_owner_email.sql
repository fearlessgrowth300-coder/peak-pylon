-- The community owner is explicitly assigned by email instead of depending on
-- which account happened to sign up first.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, handle, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1), 'New creator'),
    COALESCE(NEW.raw_user_meta_data->>'handle', '@' || split_part(NEW.email,'@',1) || '_' || substr(NEW.id::text,1,4)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    CASE
      WHEN lower(NEW.email) = 'adebayograce871@gmail.com' THEN 'admin'::public.app_role
      ELSE 'member'::public.app_role
    END
  );

  RETURN NEW;
END;
$$;

-- Correct the roles of accounts that already exist.
DELETE FROM public.user_roles WHERE role = 'admin'::public.app_role;

-- All existing non-owner accounts are regular community members until the
-- owner promotes them from the control center.
DELETE FROM public.user_roles
WHERE user_id IN (
  SELECT id FROM auth.users WHERE lower(email) <> 'adebayograce871@gmail.com'
);

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'member'::public.app_role
FROM auth.users
WHERE lower(email) <> 'adebayograce871@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE lower(email) = 'adebayograce871@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;
