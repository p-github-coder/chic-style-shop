
-- 1. Extend profiles with extra customer info
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS age int,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 2. Extend registration_applications with matching customer info for admin review
ALTER TABLE public.registration_applications
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS age int,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS city text;

-- 3. Recreate handle_new_user with extra fields, force customer role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _full_name text;
  _username text;
  _phone text;
  _age int;
  _state text;
  _city text;
  _is_admin_bootstrap boolean;
BEGIN
  _full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
  _username := NULLIF(NEW.raw_user_meta_data->>'username', '');
  _phone := NULLIF(NEW.raw_user_meta_data->>'phone', '');
  _state := NULLIF(NEW.raw_user_meta_data->>'state', '');
  _city := NULLIF(NEW.raw_user_meta_data->>'city', '');
  BEGIN
    _age := NULLIF(NEW.raw_user_meta_data->>'age', '')::int;
  EXCEPTION WHEN others THEN _age := NULL; END;
  _is_admin_bootstrap := COALESCE((NEW.raw_user_meta_data->>'is_admin_bootstrap')::boolean, false);

  INSERT INTO public.profiles (id, full_name, email, requested_role, status, username, phone, age, state, city)
  VALUES (
    NEW.id, _full_name, NEW.email, 'customer',
    CASE WHEN _is_admin_bootstrap THEN 'approved'::public.application_status ELSE 'pending'::public.application_status END,
    _username, _phone, _age, _state, _city
  )
  ON CONFLICT (id) DO NOTHING;

  IF _is_admin_bootstrap THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.registration_applications (user_id, full_name, email, requested_role, username, phone, age, state, city)
    VALUES (NEW.id, _full_name, NEW.email, 'customer', _username, _phone, _age, _state, _city)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

-- 4. Attach trigger to auth.users (this is what was missing!)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Trigger to keep profiles.updated_at fresh
DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 6. Storage policies for admins to upload brand/product images
DO $$ BEGIN
  CREATE POLICY "Public read images" ON storage.objects FOR SELECT USING (bucket_id IN ('brand-logos','product-images'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admins upload images" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id IN ('brand-logos','product-images') AND public.has_role(auth.uid(),'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admins update images" ON storage.objects FOR UPDATE
  USING (bucket_id IN ('brand-logos','product-images') AND public.has_role(auth.uid(),'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admins delete images" ON storage.objects FOR DELETE
  USING (bucket_id IN ('brand-logos','product-images') AND public.has_role(auth.uid(),'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
