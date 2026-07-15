
-- Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'customer', 'seller');
CREATE TYPE public.application_status AS ENUM ('pending', 'approved', 'rejected');

-- Extend profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS status public.application_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS requested_role public.app_role NOT NULL DEFAULT 'customer';

-- user_roles table (RBAC)
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer role check
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- user_roles policies
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Registration applications
CREATE TABLE public.registration_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text NOT NULL,
  requested_role public.app_role NOT NULL DEFAULT 'customer',
  status public.application_status NOT NULL DEFAULT 'pending',
  rejection_reason text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.registration_applications TO authenticated;
GRANT ALL ON public.registration_applications TO service_role;
ALTER TABLE public.registration_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own application" ON public.registration_applications FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Admin-manage policy for applications (update via server fn with service_role, but expose for admins too)
CREATE POLICY "Admins update applications" ON public.registration_applications FOR UPDATE
  TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Admin policies on profiles (view all)
CREATE POLICY "Admins view all profiles" ON public.profiles FOR SELECT
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Update handle_new_user trigger to create application + profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _requested_role public.app_role;
  _full_name text;
  _is_admin_bootstrap boolean;
BEGIN
  _full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
  _is_admin_bootstrap := COALESCE((NEW.raw_user_meta_data->>'is_admin_bootstrap')::boolean, false);
  BEGIN
    _requested_role := COALESCE((NEW.raw_user_meta_data->>'requested_role')::public.app_role, 'customer');
  EXCEPTION WHEN others THEN
    _requested_role := 'customer';
  END;

  INSERT INTO public.profiles (id, full_name, email, requested_role, status)
  VALUES (
    NEW.id,
    _full_name,
    NEW.email,
    _requested_role,
    CASE WHEN _is_admin_bootstrap THEN 'approved'::public.application_status ELSE 'pending'::public.application_status END
  );

  IF _is_admin_bootstrap THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.registration_applications (user_id, full_name, email, requested_role)
    VALUES (NEW.id, _full_name, NEW.email, _requested_role);
  END IF;

  RETURN NEW;
END;
$$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at trigger for applications
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER touch_apps_updated BEFORE UPDATE ON public.registration_applications
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
