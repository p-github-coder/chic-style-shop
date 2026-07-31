import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabaseAdminClient as supabase } from "@/integrations/supabase/admin-client";
import { AdminSidebar } from "@/components/AdminSidebar";

export const Route = createFileRoute("/admin/_gated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/admin/login" });
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: data.user.id,
      _role: "admin",
    });
    if (!isAdmin) throw redirect({ to: "/admin/login" });
    return { user: data.user };
  },
  component: AdminLayout,
});

function AdminLayout() {
  return (
    <div className="min-h-screen bg-background flex">
      <AdminSidebar />
      <main className="flex-1 min-w-0 pt-14 lg:pt-0">
        <Outlet />
      </main>
    </div>
  );
}

