
-- PRODUCT TYPE ENUM
CREATE TYPE public.product_type AS ENUM ('shoes', 'bags');

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- PRODUCTS
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price NUMERIC(10,2) NOT NULL,
  image_url TEXT NOT NULL,
  rating NUMERIC(2,1) NOT NULL DEFAULT 4.5,
  category TEXT NOT NULL,
  type public.product_type NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Products are public" ON public.products FOR SELECT USING (true);

-- CART ITEMS
CREATE TABLE public.cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cart_items TO authenticated;
GRANT ALL ON public.cart_items TO service_role;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own cart" ON public.cart_items FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ORDERS
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  shipping_address TEXT NOT NULL,
  payment_method TEXT NOT NULL,
  subtotal NUMERIC(10,2) NOT NULL,
  delivery_fee NUMERIC(10,2) NOT NULL,
  total NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'placed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own orders" ON public.orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create own orders" ON public.orders FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ORDER ITEMS
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  product_name TEXT NOT NULL,
  product_image TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  price NUMERIC(10,2) NOT NULL
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own order items" ON public.order_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid()));
CREATE POLICY "Users create own order items" ON public.order_items FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid()));

-- SEED PRODUCTS
INSERT INTO public.products (name, description, price, image_url, rating, category, type) VALUES
-- Shoes
('Aero Runner', 'Lightweight everyday running shoe with breathable knit upper.', 129.00, 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80', 4.7, 'Sneakers', 'shoes'),
('Classic Leather Oxford', 'Timeless full-grain leather oxford, hand-finished.', 219.00, 'https://images.unsplash.com/photo-1533867617858-e7b97e060509?w=800&q=80', 4.8, 'Formal', 'shoes'),
('Coast Loafer', 'Slip-on suede loafer perfect for warm weather.', 149.00, 'https://images.unsplash.com/photo-1614252369475-531eba835eb1?w=800&q=80', 4.5, 'Casual', 'shoes'),
('Trail Blazer Boot', 'Waterproof hiking boot with grippy Vibram sole.', 189.00, 'https://images.unsplash.com/photo-1520639888713-7851133b1ed0?w=800&q=80', 4.6, 'Boots', 'shoes'),
('Court Ace', 'Retro low-top sneaker in premium leather.', 99.00, 'https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?w=800&q=80', 4.4, 'Sneakers', 'shoes'),
('Studio Heel', 'Elegant 3-inch heel for evening occasions.', 179.00, 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=800&q=80', 4.7, 'Formal', 'shoes'),
('Beach Slide', 'Cushioned slide sandal for pool and boardwalk.', 49.00, 'https://images.unsplash.com/photo-1603487742131-4160ec999306?w=800&q=80', 4.3, 'Casual', 'shoes'),
('Alpine High Top', 'Insulated high-top boot for cold-weather commutes.', 229.00, 'https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=800&q=80', 4.6, 'Boots', 'shoes'),
-- Bags
('City Tote', 'Structured leather tote with laptop sleeve.', 189.00, 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&q=80', 4.7, 'Tote', 'bags'),
('Weekender Duffel', 'Roomy canvas duffel for short getaways.', 149.00, 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&q=80', 4.5, 'Duffel', 'bags'),
('Mini Crossbody', 'Compact crossbody in soft pebbled leather.', 129.00, 'https://images.unsplash.com/photo-1594223274512-ad4803739b7c?w=800&q=80', 4.6, 'Crossbody', 'bags'),
('Executive Briefcase', 'Slim leather briefcase for professionals.', 299.00, 'https://images.unsplash.com/photo-1547949003-9792a18a2601?w=800&q=80', 4.8, 'Briefcase', 'bags'),
('Urban Backpack', 'Water-resistant backpack with tech compartments.', 169.00, 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&q=80', 4.7, 'Backpack', 'bags'),
('Evening Clutch', 'Satin clutch with gold chain strap.', 89.00, 'https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?w=800&q=80', 4.4, 'Clutch', 'bags'),
('Bucket Bag', 'Drawstring bucket bag in soft suede.', 139.00, 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=800&q=80', 4.5, 'Crossbody', 'bags'),
('Traveler Backpack', 'Carry-on sized backpack with padded straps.', 199.00, 'https://images.unsplash.com/photo-1581605405669-fcdf81165afa?w=800&q=80', 4.6, 'Backpack', 'bags');
