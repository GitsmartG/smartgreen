CREATE TABLE public.live_notifications (
  id text PRIMARY KEY,
  match_id text NOT NULL,
  kind text NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  text text NOT NULL,
  league text NOT NULL DEFAULT '',
  league_id text NOT NULL DEFAULT '',
  minute text,
  team text,
  player text,
  result text,
  score1 integer,
  score2 integer,
  status text NOT NULL DEFAULT 'live',
  raw_status text NOT NULL DEFAULT '',
  live boolean NOT NULL DEFAULT true,
  finished boolean NOT NULL DEFAULT false,
  team1 jsonb NOT NULL DEFAULT '{}'::jsonb,
  team2 jsonb NOT NULL DEFAULT '{}'::jsonb,
  fetched_at timestamp with time zone NOT NULL DEFAULT now(),
  first_seen_at timestamp with time zone NOT NULL DEFAULT now(),
  last_seen_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.live_notifications TO anon;
GRANT SELECT ON public.live_notifications TO authenticated;
GRANT ALL ON public.live_notifications TO service_role;

ALTER TABLE public.live_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Mobile API key can read live notifications"
ON public.live_notifications
FOR SELECT
TO anon
USING (public.request_mobile_api_key() IS NOT NULL);

CREATE POLICY "Authenticated users can read live notifications"
ON public.live_notifications
FOR SELECT
TO authenticated
USING (true);

CREATE INDEX live_notifications_last_seen_idx ON public.live_notifications (last_seen_at DESC);
CREATE INDEX live_notifications_match_idx ON public.live_notifications (match_id, last_seen_at DESC);