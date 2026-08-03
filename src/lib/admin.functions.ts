import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const ADMIN_EMAIL = "uzlivinus@gmail.com";
const ADMIN_PASSWORD = "uzlivinus565";

async function ensureAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

// -------- Admin bootstrap --------
export const bootstrapAdmin = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (listErr) throw new Error(listErr.message);

  const existing = list.users.find((u) => u.email?.toLowerCase() === ADMIN_EMAIL);
  let userId: string;
  let created = false;

  if (existing) {
    userId = existing.id;
    const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(existing.id, {
      password: ADMIN_PASSWORD,
      email_confirm: true,
    });
    if (updErr) throw new Error(updErr.message);
  } else {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: "Administrator", is_admin_bootstrap: true },
    });
    if (error) throw new Error(error.message);
    userId = data.user!.id;
    created = true;
  }

  await supabaseAdmin.from("profiles").upsert(
    { id: userId, email: ADMIN_EMAIL, full_name: "Administrator", status: "approved", requested_role: "admin" },
    { onConflict: "id" },
  );
  await supabaseAdmin.from("user_roles").upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });

  return { ok: true, created };
});

// -------- Applications --------
export const listApplications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const { data, error } = await context.supabase.from("registration_applications").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  });

export const approveApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { applicationId: string }) => data)
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: app, error: fetchErr } = await supabaseAdmin.from("registration_applications").select("*").eq("id", data.applicationId).single();
    if (fetchErr) throw new Error(fetchErr.message);

    const { error: updErr } = await supabaseAdmin.from("registration_applications").update({
      status: "approved", reviewed_by: context.userId, reviewed_at: new Date().toISOString(), rejection_reason: null,
    }).eq("id", data.applicationId);
    if (updErr) throw new Error(updErr.message);

    await supabaseAdmin.from("profiles").update({ status: "approved" }).eq("id", app.user_id);
    await supabaseAdmin.from("user_roles").upsert({ user_id: app.user_id, role: app.requested_role }, { onConflict: "user_id,role" });

    // Fully activate the account: confirm the email so the customer can sign in immediately.
    const { error: confirmErr } = await supabaseAdmin.auth.admin.updateUserById(app.user_id, {
      email_confirm: true,
      ban_duration: "none",
    });
    if (confirmErr) throw new Error(confirmErr.message);

    return { ok: true };
  });

export const rejectApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { applicationId: string; reason?: string }) => data)
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: app, error: fetchErr } = await supabaseAdmin.from("registration_applications").select("user_id").eq("id", data.applicationId).single();
    if (fetchErr) throw new Error(fetchErr.message);
    const { error: updErr } = await supabaseAdmin.from("registration_applications").update({
      status: "rejected", reviewed_by: context.userId, reviewed_at: new Date().toISOString(), rejection_reason: data.reason ?? null,
    }).eq("id", data.applicationId);
    if (updErr) throw new Error(updErr.message);
    await supabaseAdmin.from("profiles").update({ status: "rejected" }).eq("id", app.user_id);
    return { ok: true };
  });

export const suspendApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { applicationId: string }) => data)
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: app, error: fetchErr } = await supabaseAdmin
      .from("registration_applications").select("user_id").eq("id", data.applicationId).single();
    if (fetchErr) throw new Error(fetchErr.message);
    if (app.user_id === context.userId) throw new Error("You cannot suspend yourself");

    const { error: updErr } = await supabaseAdmin.from("registration_applications").update({
      status: "suspended", reviewed_by: context.userId, reviewed_at: new Date().toISOString(),
    }).eq("id", data.applicationId);
    if (updErr) throw new Error(updErr.message);
    await supabaseAdmin.from("profiles").update({ status: "suspended" }).eq("id", app.user_id);
    return { ok: true };
  });

export const deleteApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { applicationId: string }) => data)
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("registration_applications")
      .delete()
      .eq("id", data.applicationId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


// -------- Dashboard metrics --------
export const getAdminMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [usersRes, rolesRes, appsRes, productsRes, ordersRes, lowStockRes, recentOrdersRes, recentRegRes, wishRes, cartRes] =
      await Promise.all([
        context.supabase.from("profiles").select("id, status", { count: "exact" }),
        context.supabase.from("user_roles").select("user_id, role"),
        context.supabase.from("registration_applications").select("status"),
        context.supabase.from("products").select("id, stock", { count: "exact" }),
        context.supabase.from("orders").select("total, status, created_at"),
        context.supabase.from("products").select("id, name, stock, image_url").lte("stock", 5).order("stock").limit(10),
        context.supabase.from("orders").select("id, order_number, customer_name, total, status, created_at").order("created_at", { ascending: false }).limit(10),
        context.supabase
          .from("registration_applications")
          .select("id, full_name, username, email, status, created_at")
          .order("created_at", { ascending: false })
          .limit(8),
        supabaseAdmin.from("wishlist_items").select("user_id"),
        supabaseAdmin.from("cart_items").select("user_id, quantity"),
      ]);
    const apps = (appsRes.data ?? []) as { status: string }[];
    const orders = (ordersRes.data ?? []) as { total: number; status: string; created_at: string }[];
    const profiles = (usersRes.data ?? []) as { id: string; status: string }[];
    const products = (productsRes.data ?? []) as { stock: number }[];
    const wishRows = (wishRes.data ?? []) as { user_id: string }[];
    const cartRows = (cartRes.data ?? []) as { user_id: string; quantity: number }[];
    // Admin accounts are staff, not customers — never count them as shoppers.
    const adminIds = new Set(
      ((rolesRes.data ?? []) as { user_id: string; role: string }[])
        .filter((r) => r.role === "admin")
        .map((r) => r.user_id),
    );
    const customers = profiles.filter((p) => !adminIds.has(p.id));
    const approvedCustomers = customers.filter((p) => p.status === "approved").length;
    return {
      // "Total customers" means approved customer accounts only.
      totalUsers: approvedCustomers,
      totalAccounts: customers.length,
      approvedCustomers,
      pendingCustomers: customers.filter((p) => p.status === "pending").length,
      rejectedCustomers: customers.filter((p) => p.status === "rejected").length,
      suspendedCustomers: customers.filter((p) => p.status === "suspended").length,

      pending: apps.filter((a) => a.status === "pending").length,
      approved: apps.filter((a) => a.status === "approved").length,
      rejected: apps.filter((a) => a.status === "rejected").length,
      suspended: apps.filter((a) => a.status === "suspended").length,
      totalProducts: productsRes.count ?? 0,
      inStock: products.filter((p) => p.stock > 5).length,
      outOfStock: products.filter((p) => p.stock <= 0).length,
      lowStock: products.filter((p) => p.stock > 0 && p.stock <= 5).length,
      totalOrders: orders.length,
      revenue: orders.filter((o) => o.status !== "cancelled").reduce((s, o) => s + Number(o.total || 0), 0),
      // Live wishlist / cart activity across all shoppers.
      wishlistItems: wishRows.length,
      wishlistUsers: new Set(wishRows.map((w) => w.user_id)).size,
      cartItems: cartRows.reduce((s, c) => s + Number(c.quantity || 0), 0),
      cartUsers: new Set(cartRows.map((c) => c.user_id)).size,
      byStatus: ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"].reduce<Record<string, number>>((acc, s) => { acc[s] = orders.filter((o) => o.status === s).length; return acc; }, {}),
      lowStockItems: lowStockRes.data ?? [],
      recentOrders: recentOrdersRes.data ?? [],
      recentRegistrations: recentRegRes.data ?? [],
    };

  });

// -------- Customers (approved only) --------
export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [profilesRes, rolesRes, ordersRes, wishRes, cartRes] = await Promise.all([
      context.supabase.from("profiles").select("*").eq("status", "approved").order("created_at", { ascending: false }),
      context.supabase.from("user_roles").select("user_id, role"),
      context.supabase.from("orders").select("user_id, total, status, created_at"),
      supabaseAdmin.from("wishlist_items").select("user_id"),
      supabaseAdmin.from("cart_items").select("user_id, quantity"),
    ]);
    const roles = new Map<string, string[]>();
    for (const r of (rolesRes.data ?? []) as { user_id: string; role: string }[]) {
      const list = roles.get(r.user_id) ?? [];
      list.push(r.role);
      roles.set(r.user_id, list);
    }
    const orderStats = new Map<string, { count: number; total: number; lastAt: string | null }>();
    for (const o of (ordersRes.data ?? []) as { user_id: string; total: number; status: string; created_at: string }[]) {
      const s = orderStats.get(o.user_id) ?? { count: 0, total: 0, lastAt: null };
      s.count++;
      // Spend reflects money actually committed — cancelled orders don't count.
      if (o.status !== "cancelled") s.total += Number(o.total);
      if (!s.lastAt || o.created_at > s.lastAt) s.lastAt = o.created_at;
      orderStats.set(o.user_id, s);
    }
    const wishCounts = new Map<string, number>();
    for (const w of (wishRes.data ?? []) as { user_id: string }[]) {
      wishCounts.set(w.user_id, (wishCounts.get(w.user_id) ?? 0) + 1);
    }
    const cartCounts = new Map<string, number>();
    for (const c of (cartRes.data ?? []) as { user_id: string; quantity: number }[]) {
      cartCounts.set(c.user_id, (cartCounts.get(c.user_id) ?? 0) + Number(c.quantity));
    }
    return (profilesRes.data ?? [])
      // Customers page lists shoppers only — admin accounts are hidden.
      .filter((p: any) => !(roles.get(p.id) ?? []).includes("admin"))
      .map((p: any) => ({
        ...p,
        roles: roles.get(p.id) ?? [],
        orderCount: orderStats.get(p.id)?.count ?? 0,
        orderTotal: orderStats.get(p.id)?.total ?? 0,
        lastOrderAt: orderStats.get(p.id)?.lastAt ?? null,
        wishlistCount: wishCounts.get(p.id) ?? 0,
        cartCount: cartCounts.get(p.id) ?? 0,
      }));


  });

// -------- Customer activity (wishlist + cart) --------
export const getCustomerActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [wishRes, cartRes, profilesRes, productsRes] = await Promise.all([
      supabaseAdmin.from("wishlist_items").select("id, user_id, product_id, created_at").order("created_at", { ascending: false }),
      supabaseAdmin.from("cart_items").select("id, user_id, product_id, quantity, created_at").order("created_at", { ascending: false }),
      supabaseAdmin.from("profiles").select("id, full_name, email"),
      supabaseAdmin.from("products").select("id, name, price, image_url"),
    ]);

    const people = new Map<string, { full_name: string; email: string }>();
    for (const p of (profilesRes.data ?? []) as any[]) people.set(p.id, { full_name: p.full_name, email: p.email });
    const prods = new Map<string, { name: string; price: number; image_url: string }>();
    for (const p of (productsRes.data ?? []) as any[]) prods.set(p.id, { name: p.name, price: Number(p.price), image_url: p.image_url });

    const decorate = (rows: any[]) =>
      rows.map((r) => ({
        ...r,
        customer_name: people.get(r.user_id)?.full_name || "—",
        customer_email: people.get(r.user_id)?.email || "—",
        product_name: prods.get(r.product_id)?.name || "—",
        product_price: prods.get(r.product_id)?.price ?? 0,
        product_image: prods.get(r.product_id)?.image_url || "",
      }));

    const wishlist = decorate((wishRes.data ?? []) as any[]);
    const cart = decorate((cartRes.data ?? []) as any[]);

    const savesByProduct = new Map<string, { product_id: string; product_name: string; product_image: string; saves: number }>();
    for (const w of wishlist) {
      const cur = savesByProduct.get(w.product_id) ?? { product_id: w.product_id, product_name: w.product_name, product_image: w.product_image, saves: 0 };
      cur.saves++;
      savesByProduct.set(w.product_id, cur);
    }

    return {
      wishlist,
      cart,
      topSaved: [...savesByProduct.values()].sort((a, b) => b.saves - a.saves).slice(0, 10),
      cartValue: cart.reduce((s, c) => s + c.product_price * Number(c.quantity), 0),
    };
  });


export const setUserStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; status: "approved" | "suspended" | "rejected" | "pending" }) => d)
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    if (data.userId === context.userId) throw new Error("You cannot change your own status");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("profiles").update({ status: data.status }).eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string }) => data)
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    if (data.userId === context.userId) throw new Error("Cannot delete yourself");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// -------- Products --------
const productSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(200),
  slug: z.string().trim().min(2).max(200).regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, dashes only"),
  description: z.string().max(4000).default(""),
  price: z.number().positive().max(10_000_000),
  image_url: z.string().url(),
  images: z.array(z.string().url()).default([]),
  stock: z.number().int().min(0).default(0),
  category_id: z.string().uuid().nullable(),
  subcategory_id: z.string().uuid().nullable().optional(),
  brand_id: z.string().uuid().nullable(),
  colors: z.array(z.string()).default([]),
  sizes: z.array(z.string()).default([]),
  rating: z.number().min(0).max(5).default(0),
  best_seller: z.boolean().default(false),
  new_arrival: z.boolean().default(false),
  featured: z.boolean().default(false),
});

export const upsertProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => productSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { error } = data.id
      ? await context.supabase.from("products").update(data).eq("id", data.id)
      : await context.supabase.from("products").insert(data);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { error } = await context.supabase.from("products").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// -------- Homepage collections (New Arrivals / Best Sellers) --------
const collectionField = z.enum(["new_arrival", "best_seller"]);

/** Toggle a product in or out of a homepage collection. */
export const setCollectionMembership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), field: collectionField, value: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const patch =
      data.field === "best_seller" ? { best_seller: data.value } : { new_arrival: data.value };
    const { error } = await context.supabase
      .from("products")
      .update(patch)
      .eq("id", data.id);

    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Update the editable rating shown on homepage cards. */
export const setProductRating = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), rating: z.number().min(0).max(5) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { error } = await context.supabase
      .from("products")
      .update({ rating: data.rating })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Persist the display order of a homepage collection. */
export const reorderCollection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ ids: z.array(z.string().uuid()).max(200) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    for (let i = 0; i < data.ids.length; i++) {
      const { error } = await context.supabase
        .from("products")
        .update({ home_sort: i })
        .eq("id", data.ids[i]);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });



// -------- Categories / Subcategories / Brands --------
const catSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(100),
  slug: z.string().trim().min(2).max(100),
  description: z.string().max(500).default(""),
  hero_image: z.string().url().or(z.literal("")).default(""),
  icon: z.string().max(60).default(""),
  sort_order: z.number().int().default(0),
});

export const upsertCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => catSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { error } = data.id
      ? await context.supabase.from("categories").update(data).eq("id", data.id)
      : await context.supabase.from("categories").insert(data);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { error } = await context.supabase.from("categories").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const subSchema = z.object({
  id: z.string().uuid().optional(),
  category_id: z.string().uuid(),
  name: z.string().trim().min(2).max(100),
  slug: z.string().trim().min(2).max(100),
});

export const upsertSubcategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => subSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { error } = data.id
      ? await context.supabase.from("subcategories").update(data).eq("id", data.id)
      : await context.supabase.from("subcategories").insert(data);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteSubcategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { error } = await context.supabase.from("subcategories").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const brandSchema = z.object({
  id: z.string().uuid().optional(),
  category_id: z.string().uuid(),
  name: z.string().trim().min(1).max(100),
  slug: z.string().trim().min(1).max(100),
  logo_url: z.string().url().or(z.literal("")).default(""),
});

export const upsertBrand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => brandSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { error } = data.id
      ? await context.supabase.from("brands").update(data).eq("id", data.id)
      : await context.supabase.from("brands").insert(data);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteBrand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { error } = await context.supabase.from("brands").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// -------- Orders --------
export const listOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const { data, error } = await context.supabase
      .from("orders")
      .select("id, order_number, customer_name, customer_email, phone, shipping_address, subtotal, delivery_fee, total, status, created_at, updated_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  });

export const getOrderDetails = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orderId: string }) => d)
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const [orderRes, itemsRes] = await Promise.all([
      context.supabase.from("orders").select("*").eq("id", data.orderId).maybeSingle(),
      context.supabase.from("order_items").select("*").eq("order_id", data.orderId),
    ]);
    if (orderRes.error) throw new Error(orderRes.error.message);
    return { order: orderRes.data, items: itemsRes.data ?? [] };
  });

export const updateOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orderId: string; status: string }) => {
    const allowed = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"];
    if (!allowed.includes(d.status)) throw new Error("Invalid status");
    return d;
  })
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { error } = await context.supabase.from("orders").update({ status: data.status }).eq("id", data.orderId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// -------- Reviews moderation --------
export const listReviews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const { data, error } = await context.supabase
      .from("reviews")
      .select("id, rating, title, body, author_name, status, created_at, reviewed_at, products(name, slug)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  });

export const moderateReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { reviewId: string; status: "approved" | "rejected" | "pending" }) => {
    if (!["approved", "rejected", "pending"].includes(d.status)) throw new Error("Invalid status");
    return d;
  })
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { error } = await context.supabase
      .from("reviews")
      .update({ status: data.status, reviewed_by: context.userId, reviewed_at: new Date().toISOString() })
      .eq("id", data.reviewId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { reviewId: string }) => d)
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { error } = await context.supabase.from("reviews").delete().eq("id", data.reviewId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// -------- Contact enquiries --------
export const listEnquiries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const { data, error } = await context.supabase
      .from("contact_messages")
      .select("id, name, email, subject, message, status, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  });

export const updateEnquiryStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; status: "unread" | "read" | "responded" }) => {
    if (!["unread", "read", "responded"].includes(d.status)) throw new Error("Invalid status");
    return d;
  })
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { error } = await context.supabase.from("contact_messages").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteEnquiry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { error } = await context.supabase.from("contact_messages").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// -------- Business contact settings --------
const settingsSchema = z.object({
  support_email: z.string().trim().email().max(255),
  phone: z.string().trim().max(60),
  address: z.string().trim().max(300),
  hours: z.string().trim().max(300),
  instagram_url: z.string().trim().max(300),
  facebook_url: z.string().trim().max(300),
  twitter_url: z.string().trim().max(300),
  whatsapp_url: z.string().trim().max(300),
});

export const updateSiteSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => settingsSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { error } = await context.supabase.from("site_settings").update(data).eq("singleton", true);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
