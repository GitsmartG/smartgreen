
DROP FUNCTION IF EXISTS public.admin_list_users();
CREATE FUNCTION public.admin_list_users()
 RETURNS TABLE(id uuid, email text, name text, role app_role, created_at timestamptz, last_sign_in_at timestamptz, access_expires_at timestamptz)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
    SELECT u.id, u.email::text, p.name,
           COALESCE((SELECT r.role FROM public.user_roles r WHERE r.user_id = u.id ORDER BY (r.role='admin') DESC LIMIT 1), 'user'::public.app_role),
           u.created_at, u.last_sign_in_at, p.access_expires_at
    FROM auth.users u LEFT JOIN public.profiles p ON p.id = u.id
    ORDER BY u.created_at DESC;
END;
$$;
