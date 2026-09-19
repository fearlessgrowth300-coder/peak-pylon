BEGIN;
CREATE UNIQUE INDEX IF NOT EXISTS community_posts_id_unique ON public.community_posts(id);
CREATE INDEX IF NOT EXISTS community_posts_channel_cursor ON public.community_posts ((data->>'channel'),created_at DESC,id DESC);
CREATE TABLE IF NOT EXISTS public.streamcore_post_events (
  sequence bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION public.record_streamcore_post_event() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE event_sequence bigint;
BEGIN
  INSERT INTO streamcore_post_events(payload)
  VALUES(jsonb_build_object('eventType',TG_OP,'new',CASE WHEN TG_OP='DELETE' THEN NULL ELSE to_jsonb(NEW) END,'old',CASE WHEN TG_OP='INSERT' THEN NULL ELSE jsonb_build_object('id',OLD.id) END))
  RETURNING sequence INTO event_sequence;
  PERFORM pg_notify('streamcore_post_events',event_sequence::text);
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.record_streamcore_post_event() FROM PUBLIC;
DROP TRIGGER IF EXISTS streamcore_post_event ON public.community_posts;
CREATE TRIGGER streamcore_post_event AFTER INSERT OR UPDATE OR DELETE ON public.community_posts
FOR EACH ROW EXECUTE FUNCTION public.record_streamcore_post_event();
GRANT SELECT ON public.streamcore_post_events TO streamcore_app;
COMMIT;
