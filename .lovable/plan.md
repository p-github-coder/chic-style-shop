This is roughly 4–5 sessions of work. I'll ship it in phases so you can review each one. Sensible defaults I'm locking in based on your request:

- **Deployment:** staying on Lovable Publish (one-click deploy of frontend + server functions + DB). Netlify can't run the auth/admin server functions without a full rewrite — click **Publish** top-right when ready. GitHub sync is under the "+" menu → GitHub if you want the code mirrored.
- **Currency:** wipe current 16 shoes/bags and reseed everything in ₦ with the new women's-accessories catalog.
- **Roles:** customer + admin only (seller signup removed — admin owns the catalog).
- **Admin login:** the credentials and bootstrap logic look correct in code; I'll add a "Reset admin password" server call to the login page so the account is force-reset to `uzlivinus565` if it already exists with a different password. Fixes the most likely cause.

---

## Phase 1 — this session (foundation)

**Schema (single migration, wipes products):**
- `categories` (slug, name, icon, sort_order)
- `subcategories` (category_id, slug, name)
- `brands` (category_id, slug, name, logo_url)
- `products` — new columns: `brand_id`, `subcategory_id`, `images text[]`, `colors text[]`, `sizes text[]`, `shades text[]`, `stock int`, `specifications jsonb`, `ingredients text`. Price stays numeric, treated as ₦.
- `reviews` (product_id, user_id, rating, title, body)
- `wishlist_items` (user_id, product_id)
- RLS + GRANTs for each. Public SELECT on catalog tables (`TO anon`), owner-scoped policies on cart/wishlist/reviews.
- Seed: 6 categories, ~25 brands, ~60 products with real ₦ prices and Unsplash images.

**Admin login fix:**
- New `resetAdminPassword` server fn — force-resets `uzlivinus@gmail.com` to `uzlivinus565` on every visit to `/admin/login` (idempotent, uses service role). No more "invalid credentials" if the account drifted.
- Better error surfacing on login failure.

**Product Details page** at `/product/$slug`:
- Image gallery + zoom on hover
- Name, brand, ₦ price, description, specs, colors/sizes/shades pickers, stock badge
- Live rating average + reviews list + "Write a review" (auth required)
- Wishlist toggle, Add to Cart, Buy Now
- Related products (same brand/subcategory)

**Public browsing:**
- Homepage: hero + shop-by-category tiles (6 categories)
- `/category/$slug` — subcategories + brands list
- `/category/$slug/$brand` — product grid with search, color/price filters, sort
- Wishlist icon on every product card
- Cart guard: browse freely, sign-in required at checkout

**Form validation:** zod schemas on signup/login/checkout with inline errors.

**Nav:** Home · Categories dropdown · Wishlist · Cart · Account.

## Phase 2 — next session (admin CRUD)
- Admin: add/edit/delete categories, brands, products
- Multi-image upload via Supabase Storage (`product-images` bucket)
- Inventory management (stock)
- Orders table view + status updates (pending/paid/shipped/delivered)
- User management (view all, delete)

## Phase 3 — next session (premium redesign + customer dashboard)
- Full luxe homepage: hero video/carousel, featured collections, new arrivals, best sellers, testimonials, newsletter, Instagram gallery, premium footer
- Feminine palette refinement (blush/champagne accents on the orange)
- Customer dashboard: order history, tracking, addresses, profile
- Animations, skeleton loaders, empty states polish

---

**Technical notes**
- Server fns in `src/lib/*.functions.ts` with `.handler()`-scoped `supabaseAdmin` imports (never top-level, per import-graph rules).
- Public catalog reads use publishable-key server client + `TO anon` policies — no admin-key reads.
- All ₦ formatting via `Intl.NumberFormat('en-NG', { currency: 'NGN' })`.
- Storage bucket for product images created in Phase 2.

**Ready?** Reply "go" and I'll ship Phase 1 (migration first for your approval, then all the code).