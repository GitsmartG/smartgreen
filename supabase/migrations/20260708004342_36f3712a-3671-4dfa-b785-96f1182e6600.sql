CREATE TABLE public.tickets (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'aguardando',
  type TEXT NOT NULL DEFAULT 'Simples',
  league TEXT NOT NULL DEFAULT '',
  event TEXT NOT NULL DEFAULT '',
  palpite TEXT NOT NULL DEFAULT '',
  odd NUMERIC NOT NULL DEFAULT 1,
  banca NUMERIC NOT NULL DEFAULT 0,
  esporte TEXT NOT NULL DEFAULT 'Futebol',
  match_date TEXT NOT NULL DEFAULT '',
  entradas INTEGER NOT NULL DEFAULT 1,
  parceiro TEXT,
  url TEXT,
  start_ms BIGINT,
  score1 INTEGER,
  score2 INTEGER,
  team1_logo TEXT,
  team2_logo TEXT,
  leg_results JSONB,
  leg_statuses JSONB,
  result_checked_at_ms BIGINT,
  created_at_ms BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.tickets TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tickets TO authenticated;
GRANT ALL ON public.tickets TO service_role;

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read tickets"
  ON public.tickets FOR SELECT USING (true);

CREATE POLICY "Authenticated can insert tickets"
  ON public.tickets FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can update tickets"
  ON public.tickets FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can delete tickets"
  ON public.tickets FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE INDEX tickets_updated_at_idx ON public.tickets (updated_at DESC);
CREATE INDEX tickets_status_idx ON public.tickets (status);