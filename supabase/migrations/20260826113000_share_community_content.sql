CREATE TABLE IF NOT EXISTS public.community_listed_members (
  id uuid PRIMARY KEY,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.community_posts (
  id uuid PRIMARY KEY,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.community_listed_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Community members are visible" ON public.community_listed_members FOR SELECT USING (true);
CREATE POLICY "Admins manage listed members" ON public.community_listed_members FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Community posts are visible" ON public.community_posts FOR SELECT USING (true);
CREATE POLICY "Signed-in members can post" ON public.community_posts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admins manage community posts" ON public.community_posts FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

GRANT SELECT ON public.community_listed_members, public.community_posts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_listed_members, public.community_posts TO authenticated;
