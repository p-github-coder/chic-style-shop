import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Users, Package, Tags, ShoppingCart, UserCog,
  Ticket, Bell, Plug, Headphones, Settings, LogOut, ShoppingBag, Bookmark, Activity,
} from "lucide-react";
import { supabaseAdminClient as supabase } from "@/integrations/supabase/admin-client";
import { useQueryClient } from "@tanstack/react-query";

const nav = [
  { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard, enabled: true },
  { to: "/admin/applications", label: "Applications", icon: Users, enabled: true },
  { to: "/admin/users", label: "Customers", icon: UserCog, enabled: true },
  { to: "/admin/products", label: "Products", icon: Package, enabled: true },
  { to: "/admin/categories", label: "Categories", icon: Tags, enabled: true },
  { to: "/admin/brands", label: "Brands", icon: Bookmark, enabled: true },
  { to: "/admin/orders", label: "Orders", icon: ShoppingCart, enabled: true },
  { to: "/admin/activity", label: "Activity", icon: Activity, enabled: true },
  { label: "Coupons", icon: Ticket },
  { label: "Notifications", icon: Bell },
  { label: "Integrations", icon: Plug },
  { label: "Support", icon: Headphones },
  { label: "Settings", icon: Settings },
] as const;

export function AdminSidebar() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/admin/login", replace: true });
  }

  return (
    <aside className="w-64 shrink-0 border-r border-border bg-card min-h-screen sticky top-0 flex flex-col">
      <div className="p-6 border-b border-border">
        <Link to="/" className="flex items-center gap-2 font-display font-bold text-lg text-primary">
          <ShoppingBag className="h-6 w-6" /> PameLuxury
        </Link>
        <div className="mt-1 text-xs text-muted-foreground">Admin console</div>
      </div>
      <nav className="flex-1 p-3 overflow-auto">
        {nav.map((item) => {
          const active = "to" in item && pathname.startsWith(item.to);
          const Content = (
            <>
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="text-sm">{item.label}</span>
              {!("enabled" in item) && (
                <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">Soon</span>
              )}
            </>
          );
          if ("enabled" in item && item.enabled) {
            return (
              <Link key={item.label} to={item.to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 transition-colors ${
                  active ? "bg-primary text-primary-foreground" : "hover:bg-accent text-foreground"
                }`}>
                {Content}
              </Link>
            );
          }
          return (
            <div key={item.label}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 text-muted-foreground cursor-not-allowed">
              {Content}
            </div>
          );
        })}
      </nav>
      <div className="p-3 border-t border-border">
        <button onClick={signOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-accent text-sm">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </aside>
  );
}
