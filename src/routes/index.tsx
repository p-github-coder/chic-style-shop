import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Sparkles, Truck, ShieldCheck, Gem } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { useAuthUser } from "@/hooks/useAuthUser";
import { ProductCard, type Product } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/Brand";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "PameLuxury — Premium Women's Accessories" },
      {
        name: "description",
        content:
          "Curated bags, jewelry, watches, hair accessories, fashion accessories and beauty essentials from the world's finest brands. Delivered across Nigeria.",
      },
      { property: "og:title", content: "PameLuxury — Premium Women's Accessories" },
      {
        property: "og:description",
        content: "Curated bags, jewelry, watches, hair accessories, fashion accessories and beauty essentials from the world's finest brands. Delivered across Nigeria.",
      },
    ],
  }),
  component: LandingPage,
});

type Category = {
  id: string;
  slug: string;
  name: string;
  description: string;
  hero_image: string;
};

function LandingPage() {
  const { data: authUser } = useAuthUser();
  // Prefer the registered username, then first name, then the email handle.
  const displayName =
    authUser?.username?.trim() ||
    (authUser?.full_name || authUser?.email || "").split(" ")[0].split("@")[0];


  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, slug, name, description, hero_image")
        .order("sort_order");
      if (error) throw error;
      return data as Category[];
    },
  });

  const { data: bestSellers = [] } = useQuery({
    queryKey: ["products", "best-sellers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, slug, name, description, price, image_url, images, rating, brands(name, slug)")
        .eq("best_seller", true)
        .order("home_sort")
        .order("rating", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data as unknown as Product[];
    },
  });

  const { data: newArrivals = [] } = useQuery({
    queryKey: ["products", "new-arrivals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, slug, name, description, price, image_url, images, rating, brands(name, slug)")
        .eq("new_arrival", true)
        .order("home_sort")
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data as unknown as Product[];
    },
  });


  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-16">
        {authUser && authUser.status === "approved" && (
          <section className="bg-accent border-b border-border">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3">
              <p className="font-display font-semibold text-lg">
                Welcome, <span className="text-primary capitalize">{displayName}</span> 👋
              </p>
              <div className="flex gap-2">
                <Button asChild size="sm" variant="outline" className="rounded-full">
                  <Link to="/wishlist">My wishlist</Link>
                </Button>
                <Button asChild size="sm" className="rounded-full">
                  <Link to="/cart">My cart</Link>
                </Button>
              </div>
            </div>
          </section>
        )}

        {/* Hero */}
        <section className="relative overflow-hidden" style={{ background: "var(--gradient-primary)" }}>
          <div className="absolute inset-0 opacity-30 mix-blend-overlay bg-[url('https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=1600')] bg-cover bg-center" />
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-20 sm:py-28 text-primary-foreground">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs sm:text-sm backdrop-blur">
                <Sparkles className="h-3.5 w-3.5" /> New Season · Autumn Edit
              </div>
              <h1 className="mt-5 text-5xl sm:text-7xl font-display font-extrabold leading-[1.05]">
                Luxury,<br />curated for you.
              </h1>
              <p className="mt-5 text-lg sm:text-xl opacity-90 max-w-lg">
                A collection of refined accessories, beauty essentials, and timeless pieces from brands you
                love — thoughtfully chosen for modern living.
              </p>

            </div>
          </div>
        </section>

        {/* Trust bar */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-10 grid sm:grid-cols-3 gap-4">
          {[
            { icon: Truck, title: "Free delivery over ₦50,000", desc: "Fast nationwide shipping." },
            { icon: ShieldCheck, title: "Secure payments", desc: "Protected checkout." },
            { icon: Gem, title: "100% authentic", desc: "Sourced from official houses." },
          ].map((f) => (
            <div key={f.title} className="flex items-center gap-4 p-5 rounded-2xl bg-card border border-border">
              <div className="h-11 w-11 rounded-full bg-accent flex items-center justify-center text-primary shrink-0">
                <f.icon className="h-5 w-5" />
              </div>
              <div>
                <div className="font-semibold">{f.title}</div>
                <div className="text-sm text-muted-foreground">{f.desc}</div>
              </div>
            </div>
          ))}
        </section>

        {/* Shop by category */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-16">
          <div className="mb-8">
            <h2 className="text-3xl sm:text-4xl font-display font-extrabold">Shop by category</h2>
            <p className="text-muted-foreground mt-1">From investment pieces to everyday staples.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {categories.map((c) => (
              <Link
                key={c.id}
                to="/category/$category"
                params={{ category: c.slug }}
                className="group relative aspect-[4/5] overflow-hidden rounded-3xl bg-card border border-border"
              >
                <img
                  src={c.hero_image}
                  alt={c.name}
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
                  <h3 className="font-display font-extrabold text-2xl">{c.name}</h3>
                  <p className="text-sm opacity-90 mt-1 line-clamp-2">{c.description}</p>
                  <div className="mt-3 inline-flex items-center gap-1 text-sm font-medium">
                    Shop now <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Best sellers */}
        {bestSellers.length > 0 && (
          <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-16">
            <div className="flex items-end justify-between mb-6">
              <div>
                <h2 className="text-3xl sm:text-4xl font-display font-extrabold">Best sellers</h2>
                <p className="text-muted-foreground mt-1">Pieces our customers love most.</p>
              </div>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {bestSellers.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          </section>
        )}

        {/* New arrivals */}
        {newArrivals.length > 0 && (
          <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-24">
            <div className="flex items-end justify-between mb-6">
              <div>
                <h2 className="text-3xl sm:text-4xl font-display font-extrabold">New arrivals</h2>
                <p className="text-muted-foreground mt-1">Fresh in this week.</p>
              </div>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {newArrivals.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          </section>
        )}

        {/* Newsletter */}
        <section className="bg-accent">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 text-center">
            <h2 className="text-3xl sm:text-4xl font-display font-extrabold">Join the list</h2>
            <p className="mt-3 text-muted-foreground max-w-lg mx-auto">
              Be first to know about new collections, private sales and members-only perks.
            </p>
            <form
              onSubmit={(e) => e.preventDefault()}
              className="mt-6 flex flex-col sm:flex-row gap-2 max-w-md mx-auto"
            >
              <input
                type="email"
                required
                placeholder="you@example.com"
                className="flex-1 h-12 px-5 rounded-full bg-background border border-border outline-none focus:ring-2 focus:ring-primary"
              />
              <Button type="submit" className="h-12 rounded-full px-6">Subscribe</Button>
            </form>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 grid md:grid-cols-4 gap-8 text-sm">
            <div>
              <div className="flex items-center gap-2 font-display font-bold text-lg text-primary">
                <BrandLogo className="h-8 w-8" /> PameLuxury
              </div>
              <p className="mt-2 text-muted-foreground">Premium women's accessories, delivered across Nigeria.</p>
            </div>
            <div>
              <div className="font-semibold mb-3">Shop</div>
              <ul className="space-y-2 text-muted-foreground">
                {categories.slice(0, 4).map((c) => (
                  <li key={c.id}>
                    <Link to="/category/$category" params={{ category: c.slug }} className="hover:text-foreground">
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="font-semibold mb-3">Help</div>
              <ul className="space-y-2 text-muted-foreground">
                <li>Shipping & returns</li>
                <li>Contact us</li>
                <li>FAQs</li>
              </ul>
            </div>
            <div>
              <div className="font-semibold mb-3">Account</div>
              <ul className="space-y-2 text-muted-foreground">
                <li><Link to="/login" className="hover:text-foreground">Sign in</Link></li>
                <li><Link to="/signup" className="hover:text-foreground">Create account</Link></li>
                <li><Link to="/wishlist" className="hover:text-foreground">Wishlist</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border py-6 text-center text-xs text-muted-foreground">
            © {new Date().getFullYear()} PameLuxury. All rights reserved.
            <span className="mx-2">·</span>
            <Link to="/admin/login" className="hover:text-foreground underline-offset-2 hover:underline">
              Admin
            </Link>
          </div>
        </footer>
      </main>
    </div>
  );
}
