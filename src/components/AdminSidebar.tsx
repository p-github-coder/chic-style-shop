import { useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Users, Package, Tags, ShoppingCart, UserCog,
  Ticket, Bell, Plug, Headphones, Settings, LogOut, Bookmark, Activity,
  Sparkles, Flame, Menu, X, Star, Mail,
} from "lucide-react";
import { supabaseAdminClient as supabase } from "@/integrations/supabase/admin-client";
import { useQueryClient } from "@tanstack/react-query";
import { BrandLogo } from "@/components/Brand";
import { ThemeToggle } from "@/components/ThemeToggle";

const nav = [
  { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard, enabled: true },
  { to: "/admin/applications", label: "Applications", icon: Users, enabled: true },
  { to: "/admin/users", label: "Customers", icon: UserCog, enabled: true },
  { to: "/admin/products", label: "Products", icon: Package, enabled: true },
  { to: "/admin/new-arrivals", label: "New Arrivals", icon: Sparkles, enabled: true },
  { to: "/admin/best-sellers", label: "Best Sellers", icon: Flame, enabled: true },
  { to: "/admin/categories", label: "Categories", icon: Tags, enabled: true },
  { to: "/admin/brands", label: "Brands", icon: Bookmark, enabled: true },
  { to: "/admin/orders", label: "Orders", icon: ShoppingCart, enabled: true },
  { to: "/admin/reviews", label: "Reviews", icon: Star, enabled: true },
  { to: "/admin/enquiries", label: "Enquiries", icon: Mail, enabled: true },
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
  const [open, setOpen] = useState(false);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/admin/login", replace: true });
  }

  const panel = (
    <>
      <div className="p-5 sm:p-6 border-b border-border">
        <Link to="/" className="flex items-center gap-2 font-display font-bold text-lg text-primary">
          <BrandLogo className="h-8 w-8" /> PameLuxury
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
              <Link key={item.label} to={item.to} onClick={() => setOpen(false)}
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
    </>
  );

  return (
    <>
      {/* Mobile top bar */}
      <header className="lg:hidden fixed top-0 inset-x-0 z-40 h-14 flex items-center justify-between gap-2 px-3 border-b border-border bg-background/95 backdrop-blur">
        <button
          onClick={() => setOpen(true)}
          aria-label="Open admin menu"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-accent"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex min-w-0 items-center gap-2 font-display font-bold text-primary">
          <BrandLogo className="h-7 w-7 shrink-0" />
          <span className="truncate">Admin</span>
        </div>
        <ThemeToggle />
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="relative w-72 max-w-[85vw] bg-card border-r border-border flex flex-col h-full">
            <button
              onClick={() => setOpen(false)}
              aria-label="Close admin menu"
              className="absolute top-3 right-3 inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent"
            >
              <X className="h-5 w-5" />
            </button>
            {panel}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 border-r border-border bg-card min-h-screen sticky top-0 flex-col">
        {panel}
        <div className="p-3 border-t border-border flex justify-end">
          <ThemeToggle />
        </div>
      </aside>
    </>
  );
}
