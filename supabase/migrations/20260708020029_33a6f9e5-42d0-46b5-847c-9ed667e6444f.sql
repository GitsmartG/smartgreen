DROP FUNCTION IF EXISTS public.validate_mobile_api_key(text);

CREATE OR REPLACE FUNCTION public.request_mobile_api_key()
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH raw_headers AS (
    SELECT current_setting('request.headers', true) AS value
  ), parsed_headers AS (
    SELECT CASE
      WHEN value IS NOT NULL AND btrim(value) LIKE '{%' THEN value::jsonb
      ELSE '{}'::jsonb
    END AS headers
    FROM raw_headers
  )
  SELECT nullif(
    btrim(
      COALESCE(
        headers ->> 'x-api-key',
        headers ->> 'X-API-Key',
        headers ->> 'apikey',
        regexp_replace(COALESCE(headers ->> 'authorization', ''), '^Bearer\s+', '', 'i')
      )
    ),
    ''
  )
  FROM parsed_headers;
$$;

GRANT EXECUTE ON FUNCTION public.request_mobile_api_key() TO anon;
GRANT EXECUTE ON FUNCTION public.request_mobile_api_key() TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_mobile_api_key() TO service_role;

GRANT SELECT ON public.api_keys TO anon;

DROP POLICY IF EXISTS "Anon can verify provided active API key" ON public.api_keys;
CREATE POLICY "Anon can verify provided active API key"
ON public.api_keys
FOR SELECT
TO anon
USING (
  active = true
  AND key = public.request_mobile_api_key()
);