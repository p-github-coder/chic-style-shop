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

// -------- Dashboard metrics --------
export const getAdminMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const [usersRes, appsRes, productsRes, ordersRes, lowStockRes, recentOrdersRes] = await Promise.all([
      context.supabase.from("profiles").select("id, status", { count: "exact" }),
      context.supabase.from("registration_applications").select("status"),
      context.supabase.from("products").select("id, stock", { count: "exact" }),
      context.supabase.from("orders").select("total, status, created_at"),
      context.supabase.from("products").select("id, name, stock, image_url").lte("stock", 5).order("stock").limit(10),
      context.supabase.from("orders").select("id, order_number, customer_name, total, status, created_at").order("created_at", { ascending: false }).limit(10),
    ]);
    const apps = (appsRes.data ?? []) as { status: string }[];
    const orders = (ordersRes.data ?? []) as { total: number; status: string; created_at: string }[];
    const profiles = (usersRes.data ?? []) as { status: string }[];
    const products = (productsRes.data ?? []) as { stock: number }[];
    return {
      totalUsers: usersRes.count ?? 0,
      approvedCustomers: profiles.filter((p) => p.status === "approved").length,
      pending: apps.filter((a) => a.status === "pending").length,
      approved: apps.filter((a) => a.status === "approved").length,
      rejected: apps.filter((a) => a.status === "rejected").length,
      totalProducts: productsRes.count ?? 0,
      outOfStock: products.filter((p) => p.stock <= 0).length,
      lowStock: products.filter((p) => p.stock > 0 && p.stock <= 5).length,
      totalOrders: orders.length,
      revenue: orders.filter((o) => o.status !== "cancelled").reduce((s, o) => s + Number(o.total || 0), 0),
      byStatus: ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"].reduce<Record<string, number>>((acc, s) => { acc[s] = orders.filter((o) => o.status === s).length; return acc; }, {}),
      lowStockItems: lowStockRes.data ?? [],
      recentOrders: recentOrdersRes.data ?? [],
    };
  });

// -------- Users --------
export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const [profilesRes, rolesRes, ordersRes] = await Promise.all([
      context.supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      context.supabase.from("user_roles").select("user_id, role"),
      context.supabase.from("orders").select("user_id, total"),
    ]);
    const roles = new Map<string, string[]>();
    for (const r of (rolesRes.data ?? []) as { user_id: string; role: string }[]) {
      const list = roles.get(r.user_id) ?? [];
      list.push(r.role);
      roles.set(r.user_id, list);
    }
    const orderStats = new Map<string, { count: number; total: number }>();
    for (const o of (ordersRes.data ?? []) as { user_id: string; total: number }[]) {
      const s = orderStats.get(o.user_id) ?? { count: 0, total: 0 };
      s.count++; s.total += Number(o.total);
      orderStats.set(o.user_id, s);
    }
    return (profilesRes.data ?? []).map((p: any) => ({
      ...p,
      roles: roles.get(p.id) ?? [],
      orderCount: orderStats.get(p.id)?.count ?? 0,
      orderTotal: orderStats.get(p.id)?.total ?? 0,
    }));
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
