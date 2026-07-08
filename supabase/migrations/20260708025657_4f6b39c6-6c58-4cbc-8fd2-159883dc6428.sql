INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::public.app_role FROM auth.users u WHERE u.email = 'usemuveweb@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

DELETE FROM public.user_roles
WHERE role = 'user'
  AND user_id IN (SELECT id FROM auth.users WHERE email = 'usemuveweb@gmail.com');