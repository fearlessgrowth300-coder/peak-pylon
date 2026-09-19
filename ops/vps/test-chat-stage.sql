BEGIN;
INSERT INTO public.community_posts(id,data,created_at)
VALUES('c3d56540-bb6d-4ffc-a1ba-f47a6e244cac','{"authorId":"infrastructure-test","text":"Isolated migration test","channel":"general"}',now());
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.streamcore_post_events WHERE payload->'new'->>'id'='c3d56540-bb6d-4ffc-a1ba-f47a6e244cac' AND payload->>'eventType'='INSERT') THEN
    RAISE EXCEPTION 'Post event trigger failed';
  END IF;
END $$;
DELETE FROM public.community_posts WHERE id='c3d56540-bb6d-4ffc-a1ba-f47a6e244cac';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.streamcore_post_events WHERE payload->'old'->>'id'='c3d56540-bb6d-4ffc-a1ba-f47a6e244cac' AND payload->>'eventType'='DELETE') THEN
    RAISE EXCEPTION 'Delete event trigger failed';
  END IF;
END $$;
ROLLBACK;
