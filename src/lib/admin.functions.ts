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

export const bootstrapAdmin = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Idempotent: only create if not present
  const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (listErr) throw new Error(listErr.message);
  const existing = list.users.find((u) => u.email?.toLowerCase() === ADMIN_EMAIL);
  if (existing) return { ok: true, created: false };

  const { error } = await supabaseAdmin.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: "Administrator", is_admin_bootstrap: true },
  });
  if (error) throw new Error(error.message);
  return { ok: true, created: true };
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
    const [usersRes, sellersRes, appsRes, productsRes] = await Promise.all([
      context.supabase.from("profiles").select("id", { count: "exact", head: true }),
      context.supabase.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "seller"),
      context.supabase.from("registration_applications").select("status"),
      context.supabase.from("products").select("id", { count: "exact", head: true }),
    ]);
    const apps = (appsRes.data ?? []) as { status: string }[];
    return {
      totalUsers: usersRes.count ?? 0,
      totalSellers: sellersRes.count ?? 0,
      pending: apps.filter((a) => a.status === "pending").length,
      approved: apps.filter((a) => a.status === "approved").length,
      rejected: apps.filter((a) => a.status === "rejected").length,
      totalProducts: productsRes.count ?? 0,
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

    await supabaseAdmin
      .from("profiles")
      .update({ status: "approved" })
      .eq("id", app.user_id);

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

    await supabaseAdmin
      .from("profiles")
      .update({ status: "rejected" })
      .eq("id", app.user_id);

    return { ok: true };
  });
