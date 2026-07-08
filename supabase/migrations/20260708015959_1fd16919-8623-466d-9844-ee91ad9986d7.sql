CREATE OR REPLACE FUNCTION public.validate_mobile_api_key(_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.api_keys
    WHERE key = btrim(_key)
      AND active = true
  );
$$;

REVOKE ALL ON FUNCTION public.validate_mobile_api_key(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_mobile_api_key(text) TO anon;
GRANT EXECUTE ON FUNCTION public.validate_mobile_api_key(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_mobile_api_key(text) TO service_role;