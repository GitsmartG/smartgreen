-- 1. Create user_fcm_tokens table
CREATE TABLE IF NOT EXISTS public.user_fcm_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  device_type text, -- 'ios' | 'android' | 'web'
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_fcm_tokens TO authenticated;
GRANT ALL ON public.user_fcm_tokens TO service_role;

-- Enable RLS
ALTER TABLE public.user_fcm_tokens ENABLE ROW LEVEL SECURITY;

-- Policies for user_fcm_tokens
CREATE POLICY "user_fcm_tokens: manage own tokens" 
  ON public.user_fcm_tokens
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_fcm_tokens: admin read all" 
  ON public.user_fcm_tokens
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2. Create push_notifications_history table
CREATE TABLE IF NOT EXISTS public.push_notifications_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  category text,
  target_audience text NOT NULL, -- 'todos', 'assinantes', 'free', 'admins'
  sent_count integer DEFAULT 0,
  status text DEFAULT 'enviada', -- 'enviada', 'agendada', 'falha'
  scheduled_for timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_notifications_history TO authenticated;
GRANT ALL ON public.push_notifications_history TO service_role;

-- Enable RLS
ALTER TABLE public.push_notifications_history ENABLE ROW LEVEL SECURITY;

-- Policies for push_notifications_history
CREATE POLICY "push_notifications_history: read all"
  ON public.push_notifications_history
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "push_notifications_history: admin manage"
  ON public.push_notifications_history
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
