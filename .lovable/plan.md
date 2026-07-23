
## Root cause

`src/routes/_admin/` uses TanStack's pathless-layout convention (leading `_`). The `_admin` segment is stripped from URLs, so:

- `src/routes/_admin/dashboard.tsx` → `/dashboard` (not `/admin/dashboard`)
- `src/routes/_admin/users.tsx` → `/users`
- …and so on for orders, brands, categories, applications.

Meanwhile the sidebar, admin login redirect, and dashboard "View all" links all point to `/admin/dashboard`, `/admin/users`, etc. → 404 on every admin page.

## Fix

Restructure the admin routes so the URLs actually live under `/admin/*`, while keeping `/admin/login` public (outside the auth gate):

```
src/routes/
  admin.login.tsx                 (unchanged — public)
  admin/
    _gated/
      route.tsx                   (auth+admin gate + AdminSidebar layout)
      dashboard.tsx               → /admin/dashboard
      applications.tsx            → /admin/applications
      users.tsx                   → /admin/users
      products.tsx                → /admin/products  (new page from prior plan)
      categories.tsx              → /admin/categories
      brands.tsx                  → /admin/brands
      orders.tsx                  → /admin/orders
```

Steps:
1. Move every file from `src/routes/_admin/` into `src/routes/admin/_gated/`.
2. Rename `_admin/route.tsx` → `admin/_gated/route.tsx` and update its `createFileRoute("/_admin")` string to `createFileRoute("/admin/_gated")`. Logic (auth check + `AdminSidebar` + `<Outlet />`) stays the same.
3. Update every child route's `createFileRoute("/_admin/<name>")` string to `createFileRoute("/admin/_gated/<name>")` (the `_gated` segment is pathless, so URLs become `/admin/<name>`).
4. Delete the now-empty `src/routes/_admin/` folder.
5. Sidebar `to="/admin/dashboard"` links and `navigate({ to: "/admin/dashboard" })` in `admin.login.tsx` will now resolve correctly — no changes needed there.

## Why `_gated` (nested pathless) rather than renaming `_admin` → `admin`

A flat `admin/route.tsx` layout would also apply its auth gate to `admin/login.tsx`, causing a redirect loop on the login page itself. Nesting the gate under `admin/_gated/` keeps `/admin/login` public while giving every other admin page the `/admin/` prefix.

## Out of scope

This plan only fixes the routing 404. Building the new Products management page and the storage bucket for image uploads remains as the previously proposed follow-up.
