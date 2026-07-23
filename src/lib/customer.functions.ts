import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getMyDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [profileRes, ordersRes, wishlistRes, cartRes, addressesRes] = await Promise.all([
      context.supabase.from("profiles").select("id, full_name, email, status, created_at").eq("id", context.userId).maybeSingle(),
      context.supabase.from("orders").select("id, order_number, status, total, created_at").eq("user_id", context.userId).order("created_at", { ascending: false }),
      context.supabase.from("wishlist_items").select("product_id").eq("user_id", context.userId),
      context.supabase.from("cart_items").select("quantity").eq("user_id", context.userId),
      context.supabase.from("addresses").select("*").eq("user_id", context.userId).order("is_default", { ascending: false }),
    ]);

    const orders = (ordersRes.data ?? []) as Array<{ id: string; order_number: string; status: string; total: number; created_at: string }>;
    const cartQty = (cartRes.data ?? []).reduce((s, r) => s + (r as { quantity: number }).quantity, 0);

    return {
      profile: profileRes.data,
      orders,
      pendingOrders: orders.filter((o) => ["pending", "confirmed", "processing"].includes(o.status)).length,
      shippedOrders: orders.filter((o) => o.status === "shipped").length,
      deliveredOrders: orders.filter((o) => o.status === "delivered").length,
      totalSpent: orders.filter((o) => o.status !== "cancelled").reduce((s, o) => s + Number(o.total), 0),
      wishlistCount: (wishlistRes.data ?? []).length,
      cartCount: cartQty,
      addresses: addressesRes.data ?? [],
    };
  });

export const getMyOrder = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orderId: string }) => d)
  .handler(async ({ context, data }) => {
    const [orderRes, itemsRes] = await Promise.all([
      context.supabase.from("orders").select("*").eq("id", data.orderId).eq("user_id", context.userId).maybeSingle(),
      context.supabase.from("order_items").select("*").eq("order_id", data.orderId),
    ]);
    if (orderRes.error) throw new Error(orderRes.error.message);
    if (!orderRes.data) throw new Error("Order not found");
    return { order: orderRes.data, items: itemsRes.data ?? [] };
  });

const addressSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().trim().min(1).max(40),
  full_name: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(7).max(20),
  address_line: z.string().trim().min(5).max(300),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().max(80).default(""),
  country: z.string().trim().max(80).default("Nigeria"),
  is_default: z.boolean().default(false),
});

export const upsertMyAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => addressSchema.parse(d))
  .handler(async ({ data, context }) => {
    if (data.is_default) {
      await context.supabase.from("addresses").update({ is_default: false }).eq("user_id", context.userId);
    }
    const row = { ...data, user_id: context.userId };
    const { error } = data.id
      ? await context.supabase.from("addresses").update(row).eq("id", data.id).eq("user_id", context.userId)
      : await context.supabase.from("addresses").insert(row);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteMyAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("addresses").delete().eq("id", data.id).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { full_name: string }) => ({ full_name: z.string().trim().min(2).max(100).parse(d.full_name) }))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("profiles").update({ full_name: data.full_name }).eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
