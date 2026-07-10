import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { ShoppingBag, LogOut, Menu, X } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function useCartCount() {
  return useQuery({
    queryKey: ["cart-count"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cart_items").select("quantity");
      if (error) throw error;
      return data.reduce((sum, r) => sum + r.quantity, 0);
    },
  });
}

export function Navbar() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const { data: cartCount = 0 } = useCartCount();

  async function handleLogout() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/login", replace: true });
  }

  const links = [
    { to: "/shoes" as const, label: "Shoes" },
    { to: "/bags" as const, label: "Bags" },
  ];

  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <Link to="/shoes" className="flex items-center gap-2 font-display font-bold text-lg text-primary shrink-0">
          <ShoppingBag className="h-6 w-6" />
          <span>Solestep</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {links.map((l) => (
            <Link key={l.to} to={l.to}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                pathname === l.to ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
              }`}>
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link to="/cart" className="relative inline-flex items-center justify-center h-10 w-10 rounded-full hover:bg-accent transition-colors" aria-label="Cart">
            <ShoppingBag className="h-5 w-5" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] font-bold h-5 min-w-5 px-1 rounded-full flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </Link>
          <Button onClick={handleLogout} variant="ghost" size="icon" className="hidden md:inline-flex rounded-full" aria-label="Sign out">
            <LogOut className="h-5 w-5" />
          </Button>
          <button className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-accent"
            onClick={() => setOpen((o) => !o)} aria-label="Menu">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden border-t border-border bg-background">
          <div className="px-4 py-3 flex flex-col gap-1">
            {links.map((l) => (
              <Link key={l.to} to={l.to} onClick={() => setOpen(false)}
                className="px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-accent">
                {l.label}
              </Link>
            ))}
            <button onClick={() => { setOpen(false); handleLogout(); }}
              className="px-4 py-2.5 rounded-lg text-sm font-medium text-left hover:bg-accent flex items-center gap-2">
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
