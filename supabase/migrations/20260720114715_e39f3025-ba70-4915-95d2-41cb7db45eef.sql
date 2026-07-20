
-- =========================================================
-- Reset old catalog data (schema migration, not seed data)
-- =========================================================
TRUNCATE public.order_items, public.orders, public.cart_items, public.products RESTART IDENTITY CASCADE;

-- =========================================================
-- CATEGORIES
-- =========================================================
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  icon text NOT NULL DEFAULT '',
  hero_image text NOT NULL DEFAULT '',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.categories TO anon, authenticated;
GRANT ALL ON public.categories TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.categories TO authenticated;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Categories are public" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Admins manage categories" ON public.categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_categories_updated BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================
-- SUBCATEGORIES
-- =========================================================
CREATE TABLE public.subcategories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  slug text NOT NULL,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category_id, slug)
);
GRANT SELECT ON public.subcategories TO anon, authenticated;
GRANT ALL ON public.subcategories TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.subcategories TO authenticated;
ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Subcategories are public" ON public.subcategories FOR SELECT USING (true);
CREATE POLICY "Admins manage subcategories" ON public.subcategories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =========================================================
-- BRANDS
-- =========================================================
CREATE TABLE public.brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  slug text NOT NULL,
  name text NOT NULL,
  logo_url text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category_id, slug)
);
GRANT SELECT ON public.brands TO anon, authenticated;
GRANT ALL ON public.brands TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.brands TO authenticated;
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Brands are public" ON public.brands FOR SELECT USING (true);
CREATE POLICY "Admins manage brands" ON public.brands FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =========================================================
-- PRODUCTS — expand
-- =========================================================
ALTER TABLE public.products
  ADD COLUMN slug text UNIQUE,
  ADD COLUMN category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  ADD COLUMN subcategory_id uuid REFERENCES public.subcategories(id) ON DELETE SET NULL,
  ADD COLUMN brand_id uuid REFERENCES public.brands(id) ON DELETE SET NULL,
  ADD COLUMN images text[] NOT NULL DEFAULT '{}',
  ADD COLUMN colors text[] NOT NULL DEFAULT '{}',
  ADD COLUMN sizes text[] NOT NULL DEFAULT '{}',
  ADD COLUMN shades text[] NOT NULL DEFAULT '{}',
  ADD COLUMN stock int NOT NULL DEFAULT 20,
  ADD COLUMN specifications jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN ingredients text NOT NULL DEFAULT '',
  ADD COLUMN featured boolean NOT NULL DEFAULT false,
  ADD COLUMN best_seller boolean NOT NULL DEFAULT false,
  ADD COLUMN new_arrival boolean NOT NULL DEFAULT false,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

-- Drop legacy columns
ALTER TABLE public.products DROP COLUMN type;
ALTER TABLE public.products DROP COLUMN category;
DROP TYPE IF EXISTS public.product_type;

-- Admin management + updated_at trigger
GRANT INSERT, UPDATE, DELETE ON public.products TO authenticated;
DROP POLICY IF EXISTS "Products are public" ON public.products;
CREATE POLICY "Products are public" ON public.products FOR SELECT USING (true);
CREATE POLICY "Admins manage products" ON public.products FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================
-- REVIEWS
-- =========================================================
CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  author_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, user_id)
);
GRANT SELECT ON public.reviews TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reviews are public" ON public.reviews FOR SELECT USING (true);
CREATE POLICY "Users write own reviews" ON public.reviews FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users edit own reviews" ON public.reviews FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own reviews or admins" ON public.reviews FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- =========================================================
-- WISHLIST
-- =========================================================
CREATE TABLE public.wishlist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);
GRANT SELECT, INSERT, DELETE ON public.wishlist_items TO authenticated;
GRANT ALL ON public.wishlist_items TO service_role;
ALTER TABLE public.wishlist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own wishlist" ON public.wishlist_items FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =========================================================
-- SEED CATEGORIES
-- =========================================================
INSERT INTO public.categories (slug, name, description, icon, hero_image, sort_order) VALUES
('bags', 'Bags', 'Handbags, totes, clutches and crossbody bags from the world''s finest houses.', 'ShoppingBag', 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=1600', 1),
('jewelry', 'Jewelry', 'Fine and demi-fine jewelry to layer, stack and treasure.', 'Gem', 'https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=1600', 2),
('watches', 'Watches', 'Timepieces from smart to luxury.', 'Watch', 'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?w=1600', 3),
('hair-accessories', 'Hair Accessories', 'Clips, claws, bows and pins to elevate every look.', 'Sparkles', 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=1600', 4),
('fashion-accessories', 'Fashion Accessories', 'Scarves, belts, hats and gloves for a polished finish.', 'Shirt', 'https://images.unsplash.com/photo-1520006403909-838d6b92c22e?w=1600', 5),
('beauty-makeup', 'Beauty & Makeup', 'Brushes, palettes and everyday essentials from cult favorites.', 'Palette', 'https://images.unsplash.com/photo-1522335789203-aaa39c6b12a3?w=1600', 6);

-- =========================================================
-- SEED SUBCATEGORIES
-- =========================================================
INSERT INTO public.subcategories (category_id, slug, name, sort_order)
SELECT c.id, s.slug, s.name, s.ord FROM public.categories c
JOIN (VALUES
  ('bags','handbags','Handbags',1),
  ('bags','tote-bags','Tote Bags',2),
  ('bags','clutch-bags','Clutch Bags',3),
  ('bags','crossbody-bags','Crossbody Bags',4),
  ('jewelry','earrings','Earrings',1),
  ('jewelry','necklaces','Necklaces',2),
  ('jewelry','bracelets','Bracelets',3),
  ('jewelry','rings','Rings',4),
  ('jewelry','jewelry-sets','Jewelry Sets',5),
  ('jewelry','anklets','Anklets',6),
  ('watches','smart-watches','Smart Watches',1),
  ('watches','fashion-watches','Fashion Watches',2),
  ('watches','luxury-watches','Luxury Watches',3),
  ('hair-accessories','hair-clips','Hair Clips',1),
  ('hair-accessories','hair-bands','Hair Bands',2),
  ('hair-accessories','claw-clips','Claw Clips',3),
  ('hair-accessories','scrunchies','Scrunchies',4),
  ('hair-accessories','hair-bows','Hair Bows',5),
  ('hair-accessories','hair-pins','Hair Pins',6),
  ('fashion-accessories','scarves','Scarves',1),
  ('fashion-accessories','belts','Belts',2),
  ('fashion-accessories','hats','Hats',3),
  ('fashion-accessories','gloves','Gloves',4),
  ('beauty-makeup','brushes','Makeup Brushes',1),
  ('beauty-makeup','lips','Lips',2),
  ('beauty-makeup','eyes','Eyes',3),
  ('beauty-makeup','face','Face',4),
  ('beauty-makeup','tools','Beauty Tools',5)
) AS s(cat_slug, slug, name, ord) ON c.slug = s.cat_slug;

-- =========================================================
-- SEED BRANDS
-- =========================================================
INSERT INTO public.brands (category_id, slug, name, sort_order)
SELECT c.id, b.slug, b.name, b.ord FROM public.categories c
JOIN (VALUES
  ('bags','chanel','Chanel',1),
  ('bags','michael-kors','Michael Kors',2),
  ('bags','coach','Coach',3),
  ('bags','prada','Prada',4),
  ('bags','louis-vuitton','Louis Vuitton',5),
  ('jewelry','pandora','Pandora',1),
  ('jewelry','bvlgari','Bvlgari',2),
  ('jewelry','mejuri','Mejuri',3),
  ('jewelry','monica-vinader','Monica Vinader',4),
  ('watches','rolex','Rolex',1),
  ('watches','omega','Omega',2),
  ('watches','michael-kors','Michael Kors',3),
  ('watches','fossil','Fossil',4),
  ('watches','cartier','Cartier',5),
  ('hair-accessories','slip','Slip',1),
  ('hair-accessories','goody','Goody',2),
  ('hair-accessories','scunci','Scünci',3),
  ('hair-accessories','kitsch','Kitsch',4),
  ('fashion-accessories','gucci','Gucci',1),
  ('fashion-accessories','versace','Versace',2),
  ('fashion-accessories','dior','Dior',3),
  ('fashion-accessories','fendi','Fendi',4),
  ('fashion-accessories','burberry','Burberry',5),
  ('beauty-makeup','real-techniques','Real Techniques',1),
  ('beauty-makeup','beautyblender','Beautyblender',2),
  ('beauty-makeup','ecotools','EcoTools',3),
  ('beauty-makeup','tweezerman','Tweezerman',4),
  ('beauty-makeup','sephora-collection','Sephora Collection',5)
) AS b(cat_slug, slug, name, ord) ON c.slug = b.cat_slug;

-- =========================================================
-- SEED PRODUCTS
-- Uses CTE lookups; slugs are globally unique.
-- =========================================================
WITH ins(cat_slug, brand_slug, sub_slug, slug, name, description, price, image, extra_images, colors, sizes, featured, best_seller, new_arrival) AS (
  VALUES
  -- ===== BAGS =====
  ('bags','chanel','handbags','chanel-classic-flap-black','Classic Flap Bag','The iconic Chanel Classic Flap in quilted lambskin with signature interlocking CC hardware. A timeless investment piece.',5200000,'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800',ARRAY['https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800','https://images.unsplash.com/photo-1591561954557-26941169b49e?w=800'],ARRAY['Black','Beige','Navy'],ARRAY['Small','Medium','Jumbo'],true,true,false),
  ('bags','chanel','clutch-bags','chanel-mini-clutch-quilted','Quilted Mini Clutch','Petite quilted evening clutch with delicate chain strap.',1850000,'https://images.unsplash.com/photo-1591561954557-26941169b49e?w=800',ARRAY[]::text[],ARRAY['Black','Ivory'],ARRAY[]::text[],true,false,true),
  ('bags','michael-kors','tote-bags','mk-mercer-large-tote','Mercer Large Tote','Roomy pebbled-leather tote with structured silhouette and gold-tone hardware.',285000,'https://images.unsplash.com/photo-1594223274512-ad4803739b7c?w=800',ARRAY['https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=800'],ARRAY['Cognac','Black','Blush'],ARRAY[]::text[],true,true,false),
  ('bags','michael-kors','crossbody-bags','mk-jet-set-crossbody','Jet Set Crossbody','Compact everyday crossbody with adjustable strap and signature MK monogram.',195000,'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=800',ARRAY[]::text[],ARRAY['Vanilla','Black'],ARRAY[]::text[],false,false,true),
  ('bags','coach','handbags','coach-tabby-shoulder','Tabby Shoulder Bag 26','Curved silhouette with the reimagined C hardware — a modern Coach signature.',380000,'https://images.unsplash.com/photo-1601924582970-9238bcb495d9?w=800',ARRAY[]::text[],ARRAY['Chalk','Black','Wine'],ARRAY[]::text[],false,true,false),
  ('bags','coach','tote-bags','coach-mollie-tote','Mollie Tote 25','Softly structured tote in glovetanned leather.',330000,'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800',ARRAY[]::text[],ARRAY['Ivory','Camel'],ARRAY[]::text[],false,false,false),
  ('bags','prada','handbags','prada-galleria-medium','Galleria Saffiano','Structured Saffiano leather bag with the iconic triangle logo.',3800000,'https://images.unsplash.com/photo-1590739225287-bd31519780c3?w=800',ARRAY[]::text[],ARRAY['Black','Bluette','Cameo'],ARRAY[]::text[],true,false,false),
  ('bags','louis-vuitton','handbags','lv-neverfull-mm','Neverfull MM','The everyday it-bag in monogram canvas with removable pouch.',4500000,'https://images.unsplash.com/photo-1600857062241-98e5dba7f214?w=800',ARRAY[]::text[],ARRAY['Monogram/Cerise','Damier'],ARRAY[]::text[],true,true,false),
  ('bags','louis-vuitton','crossbody-bags','lv-pochette-metis','Pochette Métis','Compact monogram crossbody with structured shape.',3900000,'https://images.unsplash.com/photo-1585386959984-a4155224a1ad?w=800',ARRAY[]::text[],ARRAY['Monogram'],ARRAY[]::text[],false,false,true),

  -- ===== JEWELRY =====
  ('jewelry','pandora','bracelets','pandora-moments-bracelet','Moments Snake Chain Bracelet','Sterling silver charm bracelet — build your story one charm at a time.',95000,'https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=800',ARRAY['https://images.unsplash.com/photo-1599643477877-530eb83abc8e?w=800'],ARRAY['Silver','Rose Gold','Gold'],ARRAY['17cm','19cm','21cm'],true,true,false),
  ('jewelry','pandora','rings','pandora-timeless-ring','Timeless Pavé Ring','Sparkling pavé band, effortless to stack.',65000,'https://images.unsplash.com/photo-1603561591411-07134e71a2a9?w=800',ARRAY[]::text[],ARRAY['Silver','Gold'],ARRAY['50','52','54','56','58'],false,true,false),
  ('jewelry','bvlgari','necklaces','bvlgari-bzero1-necklace','B.zero1 Rose Gold Necklace','Iconic B.zero1 pendant in 18k rose gold.',2450000,'https://images.unsplash.com/photo-1599643477877-530eb83abc8e?w=800',ARRAY[]::text[],ARRAY['Rose Gold','Yellow Gold','White Gold'],ARRAY[]::text[],true,false,true),
  ('jewelry','bvlgari','earrings','bvlgari-serpenti-studs','Serpenti Viper Studs','Delicate serpent-inspired studs with pavé diamonds.',1850000,'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800',ARRAY[]::text[],ARRAY['White Gold','Rose Gold'],ARRAY[]::text[],false,false,true),
  ('jewelry','mejuri','earrings','mejuri-bold-hoops','Bold Hoops','Everyday 14k gold-vermeil hoops.',48000,'https://images.unsplash.com/photo-1535632787350-4e68ef0ac584?w=800',ARRAY[]::text[],ARRAY['Gold','Silver'],ARRAY['Small','Medium','Large'],true,true,false),
  ('jewelry','mejuri','necklaces','mejuri-croissant-dome-necklace','Croissant Dôme Necklace','Sculptural pendant necklace in 14k gold vermeil.',52000,'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=800',ARRAY[]::text[],ARRAY['Gold'],ARRAY[]::text[],false,false,true),
  ('jewelry','monica-vinader','bracelets','mv-linear-friendship-bracelet','Linear Friendship Bracelet','Adjustable cord bracelet with 18k gold vermeil bar.',42000,'https://images.unsplash.com/photo-1584467542379-8ca3fb2f4a94?w=800',ARRAY[]::text[],ARRAY['Gold/Grey','Silver/Pink'],ARRAY[]::text[],false,false,false),

  -- ===== WATCHES =====
  ('watches','rolex','luxury-watches','rolex-datejust-31','Datejust 31 Two-Tone','Timeless Rolesor with fluted bezel and jubilee bracelet.',18500000,'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?w=800',ARRAY['https://images.unsplash.com/photo-1547996160-81dfa63595aa?w=800'],ARRAY['Silver/Gold','White/Gold'],ARRAY[]::text[],true,true,false),
  ('watches','omega','luxury-watches','omega-constellation-29','Constellation 29mm','Elegant chronometer with signature Griffes.',7500000,'https://images.unsplash.com/photo-1547996160-81dfa63595aa?w=800',ARRAY[]::text[],ARRAY['Steel','Rose Gold'],ARRAY[]::text[],false,true,false),
  ('watches','michael-kors','fashion-watches','mk-parker-rose-gold','Parker Rose Gold','Chronograph with crystal-pavé bezel.',185000,'https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=800',ARRAY[]::text[],ARRAY['Rose Gold','Gold','Silver'],ARRAY[]::text[],true,false,true),
  ('watches','fossil','smart-watches','fossil-gen6-smartwatch','Gen 6 Smartwatch','Wear OS smartwatch with heart-rate tracking and Alexa built-in.',245000,'https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=800',ARRAY[]::text[],ARRAY['Rose Gold','Black','Silver'],ARRAY[]::text[],false,true,false),
  ('watches','cartier','luxury-watches','cartier-tank-must','Tank Must SolarBeat','Iconic Tank silhouette with SolarBeat photovoltaic movement.',9800000,'https://images.unsplash.com/photo-1548171245-e5a1c5b9b9d0?w=800',ARRAY[]::text[],ARRAY['Steel/Black','Steel/Blue','Steel/Red'],ARRAY['Small','Large'],true,false,false),

  -- ===== HAIR ACCESSORIES =====
  ('hair-accessories','slip','scrunchies','slip-silk-scrunchies-set','Pure Silk Scrunchies (3-pack)','Mulberry silk scrunchies that protect hair from breakage.',38000,'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800',ARRAY[]::text[],ARRAY['Black','Pink','Champagne'],ARRAY[]::text[],true,true,false),
  ('hair-accessories','goody','hair-clips','goody-classics-clips','Classics Snap Clips','Set of 10 no-slip snap clips.',6500,'https://images.unsplash.com/photo-1613718724021-1a1cf5c1e56a?w=800',ARRAY[]::text[],ARRAY['Assorted','Black','Tortoise'],ARRAY[]::text[],false,false,false),
  ('hair-accessories','scunci','hair-bands','scunci-noslip-headband','No-Slip Grip Headband','Comfort-fit headband set — everyday essential.',5500,'https://images.unsplash.com/photo-1560869713-7d0954430b7d?w=800',ARRAY[]::text[],ARRAY['Black','Nude','Multi'],ARRAY[]::text[],false,false,true),
  ('hair-accessories','kitsch','claw-clips','kitsch-large-claw-clip','Large Tortoise Claw Clip','Oversized statement claw clip in tortoise resin.',9800,'https://images.unsplash.com/photo-1595341595379-cf1cd0fb7fb1?w=800',ARRAY[]::text[],ARRAY['Tortoise','Black','Cream'],ARRAY[]::text[],true,false,true),

  -- ===== FASHION ACCESSORIES =====
  ('fashion-accessories','gucci','belts','gucci-marmont-belt','GG Marmont Belt','Leather belt with textured double-G buckle.',680000,'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=800',ARRAY[]::text[],ARRAY['Black/Gold','Nude/Gold'],ARRAY['75','80','85','90','95'],true,true,false),
  ('fashion-accessories','versace','scarves','versace-medusa-silk-scarf','Medusa Silk Twill Scarf','Baroque-print silk scarf with signature Medusa motif.',420000,'https://images.unsplash.com/photo-1520006403909-838d6b92c22e?w=800',ARRAY[]::text[],ARRAY['Gold','Fuchsia','Emerald'],ARRAY['90x90cm'],false,false,true),
  ('fashion-accessories','dior','hats','dior-bucket-hat-oblique','Oblique Bucket Hat','Signature Oblique jacquard bucket hat.',560000,'https://images.unsplash.com/photo-1533055640609-24b498dfd74c?w=800',ARRAY[]::text[],ARRAY['Beige','Navy'],ARRAY['S','M','L'],false,true,false),
  ('fashion-accessories','burberry','scarves','burberry-cashmere-check-scarf','Cashmere Check Scarf','Icon-check scarf in soft brushed cashmere.',720000,'https://images.unsplash.com/photo-1601924572367-b1e9e2a2df31?w=800',ARRAY[]::text[],ARRAY['Camel','Rose Beige','Stone'],ARRAY[]::text[],true,false,false),
  ('fashion-accessories','fendi','belts','fendi-ff-reversible-belt','FF Reversible Belt','Reversible leather belt with FF buckle.',520000,'https://images.unsplash.com/photo-1591348277626-be3f1c342c9c?w=800',ARRAY[]::text[],ARRAY['Tan/Black'],ARRAY['80','85','90'],false,false,true),

  -- ===== BEAUTY & MAKEUP =====
  ('beauty-makeup','real-techniques','brushes','rt-everyday-essentials','Everyday Essentials Kit','5-piece brush and sponge set for a flawless base.',22000,'https://images.unsplash.com/photo-1522335789203-aaa39c6b12a3?w=800',ARRAY['https://images.unsplash.com/photo-1596704017254-9b121068fb31?w=800'],ARRAY['Orange','Pink'],ARRAY[]::text[],true,true,false),
  ('beauty-makeup','beautyblender','tools','beautyblender-original','Original Beautyblender','The iconic edgeless makeup sponge for a seamless finish.',12500,'https://images.unsplash.com/photo-1596704017254-9b121068fb31?w=800',ARRAY[]::text[],ARRAY['Pink','Black','Nude'],ARRAY[]::text[],false,true,false),
  ('beauty-makeup','ecotools','brushes','ecotools-brush-set-6pc','6-Piece Start the Day Set','Sustainable everyday brush set.',15500,'https://images.unsplash.com/photo-1596704017173-7c9c7a5c0f8b?w=800',ARRAY[]::text[],ARRAY['Bamboo/Pink'],ARRAY[]::text[],false,false,true),
  ('beauty-makeup','tweezerman','tools','tweezerman-slant-tweezer','Slant Tweezer','Award-winning stainless-steel slant tweezer.',18500,'https://images.unsplash.com/photo-1583241800698-e8ab01830a07?w=800',ARRAY[]::text[],ARRAY['Classic Red','Rose Gold','Black'],ARRAY[]::text[],false,false,false),
  ('beauty-makeup','sephora-collection','lips','sephora-cream-lip-stain','Cream Lip Stain','Long-wear matte liquid lipstick in creamy formula.',9500,'https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=800',ARRAY['https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=800'],ARRAY[]::text[],ARRAY[]::text[],true,true,false),
  ('beauty-makeup','sephora-collection','face','sephora-best-skin-foundation','Best Skin Ever Foundation','Weightless liquid foundation with a natural finish.',14500,'https://images.unsplash.com/photo-1631730359585-38a4935cbec4?w=800',ARRAY[]::text[],ARRAY[]::text[],ARRAY['30ml'],false,false,true),
  ('beauty-makeup','sephora-collection','eyes','sephora-liquid-liner','Liquid Eyeliner','Ultra-precise felt-tip liner with 24h wear.',7500,'https://images.unsplash.com/photo-1631214540553-ff044a3ff1d4?w=800',ARRAY[]::text[],ARRAY[]::text[],ARRAY[]::text[],false,true,false),
  ('beauty-makeup','sephora-collection','eyes','sephora-mascara-outrageous','Outrageous Volume Mascara','Buildable volume and lift with a curved brush.',8500,'https://images.unsplash.com/photo-1631214504-3c5a7c8f4a15?w=800',ARRAY[]::text[],ARRAY[]::text[],ARRAY[]::text[],false,false,true)
)
INSERT INTO public.products (
  slug, name, description, price, image_url, images,
  category_id, subcategory_id, brand_id,
  colors, sizes, stock, rating, featured, best_seller, new_arrival
)
SELECT
  i.slug, i.name, i.description, i.price, i.image,
  ARRAY[i.image] || i.extra_images,
  c.id, s.id, b.id,
  i.colors, i.sizes,
  25, 4.6, i.featured, i.best_seller, i.new_arrival
FROM ins i
JOIN public.categories c ON c.slug = i.cat_slug
JOIN public.brands b ON b.category_id = c.id AND b.slug = i.brand_slug
JOIN public.subcategories s ON s.category_id = c.id AND s.slug = i.sub_slug;

-- Small rating variety for realism
UPDATE public.products SET rating = 4.9 WHERE featured = true;
UPDATE public.products SET rating = 4.8 WHERE best_seller = true AND rating < 4.9;
UPDATE public.products SET rating = 4.7 WHERE new_arrival = true AND rating < 4.8;
