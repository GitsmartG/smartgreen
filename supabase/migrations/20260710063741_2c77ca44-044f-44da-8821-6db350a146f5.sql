
CREATE OR REPLACE FUNCTION public.admin_set_access_expiry(_target uuid, _expires_at timestamptz)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  INSERT INTO public.profiles (id, access_expires_at) VALUES (_target, _expires_at)
  ON CONFLICT (id) DO UPDATE SET access_expires_at = EXCLUDED.access_expires_at;
END;
$$;
