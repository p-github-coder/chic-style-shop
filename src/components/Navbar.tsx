import { Link, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { ShoppingBag, LogOut, Menu, X, User, Heart, Search } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { BrandLockup } from "@/components/Brand";
import { ThemeToggle } from "@/components/ThemeToggle";


export function useCartCount(enabled: boolean) {
  return useQuery({
    queryKey: ["cart-count"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from("cart_items").select("quantity");
      if (error) throw error;
      return data.reduce((sum, r) => sum + r.quantity, 0);
    },
  });
}

/** Categories come straight from the database, so anything the admin adds
 *  shows up in the navigation (and everywhere else) with no code change. */
function useCategoryLinks() {
  const { data = [] } = useQuery({
    queryKey: ["categories", "nav"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, slug, name")
        .order("sort_order");
      if (error) throw error;
      return data as { id: string; slug: string; name: string }[];
    },
  });
  return data;
}


export function Navbar() {
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const categoryLinks = useCategoryLinks();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setSignedIn(!!session);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const { data: cartCount = 0 } = useCartCount(!!signedIn);

  async function handleLogout() {
    await queryClient.cancelQueries();
    await supabase.auth.signOut({ scope: "local" });
    // Wipe every trace of the previous shopper before the next paint.
    setSignedIn(false);
    queryClient.clear();
    queryClient.removeQueries();
    if (typeof window !== "undefined") {
      localStorage.removeItem("pl:recentlyViewed");
      sessionStorage.clear();
    }
    toast.success("Signed out");
    navigate({ to: "/", replace: true });
    await router.invalidate();
  }


  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-background/85 backdrop-blur-lg border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2 font-display font-bold text-lg text-primary shrink-0">
          <BrandLockup logoClassName="h-8 w-8" />
        </Link>

        <nav className="hidden lg:flex items-center gap-1">
          <Link
            to="/"
            className={`px-3 py-2 rounded-full text-sm font-medium transition-colors ${
              pathname === "/" ? "text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Home
          </Link>
          {categoryLinks.map((c) => (
            <Link
              key={c.id}
              to="/category/$category"
              params={{ category: c.slug }}
              className={`px-3 py-2 rounded-full text-sm font-medium transition-colors ${
                pathname.startsWith(`/category/${c.slug}`)
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {c.name}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Link
            to="/search"
            className="hidden sm:inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-accent"
            aria-label="Search"
          >
            <Search className="h-5 w-5" />
          </Link>
          <Link
            to="/wishlist"
            className="hidden sm:inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-accent"
            aria-label="Wishlist"
          >

            <Heart className="h-5 w-5" />
          </Link>
          <Link
            to="/cart"
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-accent"
            aria-label="Cart"
          >
            <ShoppingBag className="h-5 w-5" />
            {signedIn && cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] font-bold h-5 min-w-5 px-1 rounded-full flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </Link>

          {signedIn ? (
            <Button onClick={handleLogout} variant="ghost" size="icon" className="hidden md:inline-flex rounded-full" aria-label="Sign out">
              <LogOut className="h-5 w-5" />
            </Button>
          ) : (
            <div className="hidden md:flex items-center gap-2 ml-2">
              <Button asChild variant="ghost" className="rounded-full">
                <Link to="/login">Sign in</Link>
              </Button>
              <Button asChild className="rounded-full">
                <Link to="/signup">Sign up</Link>
              </Button>
            </div>
          )}

          <button
            className="lg:hidden inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-accent"
            onClick={() => setOpen((o) => !o)}
            aria-label="Menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="lg:hidden border-t border-border bg-background max-h-[80vh] overflow-auto">
          <div className="px-4 py-3 flex flex-col gap-1">
            <Link to="/" onClick={() => setOpen(false)} className="px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-accent">
              Home
            </Link>
            {categoryLinks.map((c) => (
              <Link
                key={c.id}
                to="/category/$category"
                params={{ category: c.slug }}
                onClick={() => setOpen(false)}
                className="px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-accent"
              >
                {c.name}
              </Link>
            ))}
            <Link to="/wishlist" onClick={() => setOpen(false)} className="px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-accent flex items-center gap-2">
              <Heart className="h-4 w-4" /> Wishlist
            </Link>
            {signedIn ? (
              <button
                onClick={() => { setOpen(false); handleLogout(); }}
                className="px-4 py-2.5 rounded-lg text-sm font-medium text-left hover:bg-accent flex items-center gap-2"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            ) : (
              <>
                <Link to="/login" onClick={() => setOpen(false)} className="px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-accent flex items-center gap-2">
                  <User className="h-4 w-4" /> Sign in
                </Link>
                <Link to="/signup" onClick={() => setOpen(false)} className="px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-accent">
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
