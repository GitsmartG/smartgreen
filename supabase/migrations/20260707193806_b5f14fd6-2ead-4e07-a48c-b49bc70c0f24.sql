
CREATE TABLE IF NOT EXISTS public.daily_matches (
  match_date DATE NOT NULL PRIMARY KEY,
  payload JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT NOT NULL DEFAULT 'statpal'
);

GRANT SELECT ON public.daily_matches TO anon;
GRANT SELECT ON public.daily_matches TO authenticated;
GRANT ALL ON public.daily_matches TO service_role;

ALTER TABLE public.daily_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read daily matches"
  ON public.daily_matches FOR SELECT
  USING (true);
