DROP POLICY IF EXISTS "Authenticated can update feature flags" ON public.feature_flags;
DROP POLICY IF EXISTS "Authenticated can insert feature flags" ON public.feature_flags;

CREATE POLICY "Authenticated can update feature flags"
  ON public.feature_flags FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can insert feature flags"
  ON public.feature_flags FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);