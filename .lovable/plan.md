## What I verified first

- The catalog data is clean: all 38 products have a category, brand and subcategory. So "Rolex → Watches → Smart Watches" returns nothing because Rolex only has Luxury Watches products — the filter code is actually correct, but the UI lets you pick impossible combinations and then shows an empty page, which reads as broken.
- Some records have typos from admin edits ("Bagss" category, "Rolexx" brand) which makes filters look wrong.
- Realtime is not enabled on any table (`supabase_realtime` publication is empty), so nothing on the admin side updates automatically today — only the dashboard polls every 30s.
- `/admin/users` already pulls live wishlist/cart/order stats but has no Status column; `/admin/applications` already groups all four statuses but doesn't live-update.
- The signed-in greeting uses full name, and the shared auth hook doesn't load `username` at all.

## 1. Real-time backend sync

- Enable realtime on `profiles`, `registration_applications`, `products`, `orders`, `wishlist_items`, `cart_items`.
- Add a small shared hook that subscribes to those tables and invalidates the matching admin/customer caches, so applications, customers, dashboard, activity, and product pages refresh the moment data changes — no manual reload. Subscriptions are set up once per page and cleaned up on unmount.
- Keep a slow polling fallback so numbers stay right even if a socket drops.

## 2. `/admin/users`

- Add the missing **Status** column and an **Orders** breakdown (count + last order date), and make "Total Spent" count only non-cancelled orders.
- Keep every value sourced from the live backend; the table re-renders through the realtime hook.

## 3. `/admin/applications`

- Keep the existing approve / reject / suspend / delete actions.
- Restructure into clearly labelled status sections (Pending, Approved, Rejected, Suspended) with live counts, driven by realtime so a brand-new signup appears without a refresh.
- Verify the signup trigger end-to-end so every new account lands in Pending.

## 4. Product filtering

- Move filter state into the URL (`?brand=&type=&q=&sort=`) so filters survive refresh and can be shared, still applying instantly with no page reload.
- Show a live result count on every brand and type chip, and disable chips that would produce zero results for the current selection — so "Rolex + Smart Watches" is visibly unavailable instead of returning an empty grid.
- Apply the same combined Type + Brand + Category logic consistently on the category page, the brand page, and search.
- Clean up the typo'd "Bagss" category and "Rolexx" brand names so labels match what customers expect.

## 5. Personalization

- Load `username` in the shared auth hook and greet with it (`Welcome, Pamela!`), falling back to first name then email.
- Re-verify that wishlist, cart, orders and account data are strictly scoped to the signed-in user (owner-only access rules), and that they clear on sign-out.

## 6. Admin dashboard

- Add the missing live tiles: wishlist activity, cart activity, total customer spending, and recent registrations, alongside the existing customer/application/product/order metrics.
- Wire the dashboard to the realtime hook so every stat recomputes on any registration, approval, product edit, stock change, wishlist/cart change or order.

## 7. Hosting note

The site and admin dashboard already run entirely on hosted infrastructure — the published URL and the backend keep working with your laptop off. The local dev server is only used while I'm building. No change needed; I'll confirm it during the audit.

## 8. QA audit

End-to-end pass with a headless browser: sign up → appears as Pending → approve → immediate login → personalized greeting → browse with combined filters → wishlist/cart → admin sees the activity live. Plus a security-rules check on the tables newly exposed to realtime, and a typecheck/build.

### Technical notes

Realtime is added via a migration on the publication only (no schema change). Filter state uses TanStack Router `validateSearch` + `useSearch`. The realtime hook invalidates TanStack Query keys rather than mutating caches directly, so server functions stay the single source of truth. Existing product/category/brand CRUD code is left untouched.
