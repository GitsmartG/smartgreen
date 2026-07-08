
-- 1. profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles: own read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles: own update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- 2. roles
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin','user');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_roles: own read" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 3. has_role (security definer, evita recursão)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- Admin pode ler/mudar tudo em user_roles
CREATE POLICY "user_roles: admin read all" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "user_roles: admin write" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Admin pode ler todos profiles
CREATE POLICY "profiles: admin read all" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 4. trigger que cria profile + primeira role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  first_user boolean;
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;

  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') INTO first_user;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN first_user THEN 'admin'::public.app_role ELSE 'user'::public.app_role END)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. RPC que admin usa pra listar todos usuários (junta profiles + roles + auth.users)
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  id uuid,
  email text,
  name text,
  role public.app_role,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
    SELECT u.id, u.email::text, p.name,
           COALESCE((SELECT r.role FROM public.user_roles r WHERE r.user_id = u.id ORDER BY (r.role='admin') DESC LIMIT 1), 'user'::public.app_role),
           u.created_at, u.last_sign_in_at
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    ORDER BY u.created_at DESC;
END;
$$;

-- 6. RPC pra admin promover/rebaixar
CREATE OR REPLACE FUNCTION public.admin_set_role(_target uuid, _role public.app_role)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  DELETE FROM public.user_roles WHERE user_id = _target;
  INSERT INTO public.user_roles (user_id, role) VALUES (_target, _role);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;

-- 7. Retroativo: cria profile + role pra usuários já existentes
INSERT INTO public.profiles (id, name, email)
SELECT u.id,
       COALESCE(u.raw_user_meta_data->>'name', u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
       u.email
FROM auth.users u
ON CONFLICT (id) DO NOTHING;

-- Primeiro usuário criado vira admin (se nenhum admin ainda)
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, CASE WHEN u.id = (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1)
                    AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin')
                  THEN 'admin'::public.app_role
                  ELSE 'user'::public.app_role END
FROM auth.users u
ON CONFLICT DO NOTHING;
