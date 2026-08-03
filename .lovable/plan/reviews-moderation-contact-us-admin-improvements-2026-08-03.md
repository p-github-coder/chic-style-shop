# Reviews Moderation, Contact Us & Admin Improvements

## 1. Review approval workflow

- Add a moderation status to reviews (`pending` / `approved` / `rejected`) with a reviewed-by/reviewed-at record.
- Public product pages show only approved reviews (name, rating, review text, date). The star average uses approved reviews only.
- After a customer submits a review they see a "Your review is awaiting approval" note, and their own pending review is visible to them alone.
- New admin page **Reviews** (`/admin/reviews`) in the sidebar: table of all reviews with product, reviewer name, rating, content, submission date, and status filter tabs (Pending / Approved / Rejected / All). Approve and Reject buttons update instantly; a pending count badge shows on the sidebar link.

## 2. Contact Us system

- New public page `/contact`, linked from the footer Help column (replacing the current placeholder links) and reachable from the nav footer area.
- Form: Name, Email, Subject, Message, Send button — validated with Zod, stored in the database, with success/error toasts.
- Sidebar panel on the page shows support email, phone, address, operating hours and social links — all read from an admin-editable settings record, not hardcoded.
- New admin page **Enquiries** (`/admin/enquiries`): list of all messages with status (Unread / Read / Responded), detail view, mark-as-read / mark-as-responded actions, unread count badge, and delete. A **Contact details** panel on the same page lets the admin edit phone, address, email, hours and social links.

## 3. Logout behaviour

- Sign Out will clear session, cart/wishlist caches and greetings before navigating, with no manual refresh: cancel and clear all queries, clear local/session personalization keys, reset the auth state broadcast, and force a router invalidation so the homepage re-renders in guest state immediately. Applies to the desktop and mobile menus.

## 4. Rejected applications delete

- The red bin icon opens a confirmation dialog ("Permanently delete this application?").
- On confirm, the row is removed optimistically so it disappears without a refresh, the server deletes it, and dashboard metrics/customers queries are invalidated so statistics update automatically. Failures roll the row back with an error toast.

## Technical notes

- Migration: `reviews.status` (new enum) + `reviewed_by` / `reviewed_at`; RLS updated so public SELECT is limited to approved rows, authors can read their own, admins can read/update all. New `contact_messages` table (name, email, subject, message, status) — insert open to anyone, read/update admin-only. New single-row `site_settings` table (support email, phone, address, hours, social links) — public read, admin write. GRANTs included for every new table.
- Server functions added to `src/lib/admin.functions.ts` (list/approve/reject reviews, list/update/delete enquiries, update settings) and a public `src/lib/contact.functions.ts` for form submission.
- Review submission in `src/routes/product.$slug.tsx` switches to the pending flow; approved-only queries drive the public list.
- Admin pages follow the existing `_gated` route + `useRealtimeSync` pattern so lists refresh live.
