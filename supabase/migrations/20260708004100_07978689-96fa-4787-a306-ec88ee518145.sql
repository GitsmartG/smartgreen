CREATE TABLE public.feature_flags (
  key TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.feature_flags TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feature_flags TO authenticated;
GRANT ALL ON public.feature_flags TO service_role;

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read feature flags"
  ON public.feature_flags FOR SELECT
  USING (true);

CREATE POLICY "Authenticated can update feature flags"
  ON public.feature_flags FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can insert feature flags"
  ON public.feature_flags FOR INSERT TO authenticated
  WITH CHECK (true);

INSERT INTO public.feature_flags (key, enabled) VALUES
  ('jogos', true),
  ('ligas', true),
  ('banca', true),
  ('parceiros', true),
  ('indique', true)
ON CONFLICT (key) DO NOTHING;