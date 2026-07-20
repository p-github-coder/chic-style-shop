import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

// Idempotent: create admin if missing OR reset password if drifted, and ensure admin role.
export const bootstrapAdmin = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (listErr) throw new Error(listErr.message);

  const existing = list.users.find((u) => u.email?.toLowerCase() === ADMIN_EMAIL);
  let userId: string;
  let created = false;

  if (existing) {
    userId = existing.id;
    // Force-reset the password + confirm email so login always works
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

  // Ensure profile approved
  await supabaseAdmin
    .from("profiles")
    .upsert(
      { id: userId, email: ADMIN_EMAIL, full_name: "Administrator", status: "approved", requested_role: "admin" },
      { onConflict: "id" },
    );

  // Ensure admin role
  await supabaseAdmin
    .from("user_roles")
    .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });

  return { ok: true, created };
});

export const listApplications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const { data, error } = await context.supabase
      .from("registration_applications")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  });

export const getAdminMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const [usersRes, appsRes, productsRes, ordersRes] = await Promise.all([
      context.supabase.from("profiles").select("id", { count: "exact", head: true }),
      context.supabase.from("registration_applications").select("status"),
      context.supabase.from("products").select("id", { count: "exact", head: true }),
      context.supabase.from("orders").select("total"),
    ]);
    const apps = (appsRes.data ?? []) as { status: string }[];
    const orders = (ordersRes.data ?? []) as { total: number }[];
    return {
      totalUsers: usersRes.count ?? 0,
      pending: apps.filter((a) => a.status === "pending").length,
      approved: apps.filter((a) => a.status === "approved").length,
      rejected: apps.filter((a) => a.status === "rejected").length,
      totalProducts: productsRes.count ?? 0,
      totalOrders: orders.length,
      revenue: orders.reduce((s, o) => s + Number(o.total || 0), 0),
    };
  });

export const approveApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { applicationId: string }) => data)
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: app, error: fetchErr } = await supabaseAdmin
      .from("registration_applications")
      .select("*")
      .eq("id", data.applicationId)
      .single();
    if (fetchErr) throw new Error(fetchErr.message);

    const { error: updErr } = await supabaseAdmin
      .from("registration_applications")
      .update({
        status: "approved",
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
        rejection_reason: null,
      })
      .eq("id", data.applicationId);
    if (updErr) throw new Error(updErr.message);

    await supabaseAdmin.from("profiles").update({ status: "approved" }).eq("id", app.user_id);
    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: app.user_id, role: app.requested_role }, { onConflict: "user_id,role" });

    return { ok: true };
  });

export const rejectApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { applicationId: string; reason?: string }) => data)
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: app, error: fetchErr } = await supabaseAdmin
      .from("registration_applications")
      .select("user_id")
      .eq("id", data.applicationId)
      .single();
    if (fetchErr) throw new Error(fetchErr.message);

    const { error: updErr } = await supabaseAdmin
      .from("registration_applications")
      .update({
        status: "rejected",
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
        rejection_reason: data.reason ?? null,
      })
      .eq("id", data.applicationId);
    if (updErr) throw new Error(updErr.message);

    await supabaseAdmin.from("profiles").update({ status: "rejected" }).eq("id", app.user_id);
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
