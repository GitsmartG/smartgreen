ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS scheduled_at_ms bigint;
CREATE INDEX IF NOT EXISTS tickets_scheduled_at_ms_idx ON public.tickets (scheduled_at_ms);