DROP POLICY IF EXISTS "Mobile API key can read live notifications" ON public.live_notifications;

CREATE POLICY "Mobile active API key can read live notifications"
ON public.live_notifications
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1
    FROM public.api_keys
    WHERE api_keys.active = true
      AND api_keys.key = public.request_mobile_api_key()
  )
);