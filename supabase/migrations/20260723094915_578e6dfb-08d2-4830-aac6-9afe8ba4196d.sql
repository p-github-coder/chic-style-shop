
ALTER TYPE public.application_status ADD VALUE IF NOT EXISTS 'suspended';

CREATE TABLE IF NOT EXISTS public.addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Home',
  full_name text NOT NULL,
  phone text NOT NULL DEFAULT '',
  address_line text NOT NULL,
  city text NOT NULL,
  state text NOT NULL DEFAULT '',
  country text NOT NULL DEFAULT 'Nigeria',
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.addresses TO authenticated;
GRANT ALL ON public.addresses TO service_role;
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own addresses" ON public.addresses;
CREATE POLICY "Users manage own addresses" ON public.addresses
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins view all addresses" ON public.addresses;
CREATE POLICY "Admins view all addresses" ON public.addresses
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
DROP TRIGGER IF EXISTS trg_addresses_updated ON public.addresses;
CREATE TRIGGER trg_addresses_updated BEFORE UPDATE ON public.addresses
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_number text UNIQUE,
  ADD COLUMN IF NOT EXISTS phone text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS city text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS state text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS country text NOT NULL DEFAULT 'Nigeria',
  ADD COLUMN IF NOT EXISTS notes text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.orders SET status = 'pending' WHERE status NOT IN ('pending','confirmed','processing','shipped','delivered','cancelled');
ALTER TABLE public.orders ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending','confirmed','processing','shipped','delivered','cancelled'));

DROP TRIGGER IF EXISTS trg_orders_updated ON public.orders;
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.set_order_number()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := 'PL-' || to_char(now(), 'YYMMDD') || '-' || upper(substring(replace(NEW.id::text, '-', ''), 1, 6));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_orders_number ON public.orders;
CREATE TRIGGER trg_orders_number BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_order_number();

UPDATE public.orders
   SET order_number = 'PL-' || to_char(created_at, 'YYMMDD') || '-' || upper(substring(replace(id::text, '-', ''), 1, 6))
 WHERE order_number IS NULL OR order_number = '';

DROP POLICY IF EXISTS "Admins view all orders" ON public.orders;
CREATE POLICY "Admins view all orders" ON public.orders
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins update all orders" ON public.orders;
CREATE POLICY "Admins update all orders" ON public.orders
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins view all order items" ON public.order_items;
CREATE POLICY "Admins view all order items" ON public.order_items
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins update profiles" ON public.profiles;
CREATE POLICY "Admins update profiles" ON public.profiles
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins delete profiles" ON public.profiles;
CREATE POLICY "Admins delete profiles" ON public.profiles
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
