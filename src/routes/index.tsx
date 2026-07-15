import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Sparkles, Truck, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { ProductCard, type Product } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  ssr: false,
  component: LandingPage,
});

function LandingPage() {
  const { data: featured } = useQuery({
    queryKey: ["products", "featured"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("rating", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data as Product[];
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-16">
        {/* Hero */}
        <section className="relative overflow-hidden" style={{ background: "var(--gradient-primary)" }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-primary-foreground">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-sm backdrop-blur">
                <Sparkles className="h-4 w-4" /> New season drops
              </div>
              <h1 className="mt-5 text-5xl sm:text-6xl font-display font-extrabold leading-tight">
                Shoes and bags,<br />built for every step.
              </h1>
              <p className="mt-4 text-lg opacity-90 max-w-lg">
                Discover premium fashion accessories from independent makers — curated weekly, shipped worldwide.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg" variant="secondary" className="rounded-full">
                  <Link to="/shoes">Shop shoes <ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="rounded-full bg-white/10 border-white/30 text-primary-foreground hover:bg-white/20 hover:text-primary-foreground">
                  <Link to="/bags">Shop bags</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Feature strip */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12 grid sm:grid-cols-3 gap-4">
          {[
            { icon: Truck, title: "Free shipping over $99", desc: "Delivered to your door." },
            { icon: ShieldCheck, title: "Secure checkout", desc: "Protected payments." },
            { icon: Sparkles, title: "Curated weekly", desc: "New drops every Friday." },
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

        {/* Featured products */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-16">
          <div className="flex items-end justify-between mb-6">
            <div>
              <h2 className="text-3xl sm:text-4xl font-display font-extrabold">Trending now</h2>
              <p className="text-muted-foreground mt-1">Handpicked from our top-rated pieces.</p>
            </div>
            <Link to="/shoes" className="hidden sm:inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              See all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {(featured ?? []).map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      </main>

      {/* Discreet admin link */}
      <Link
        to="/admin/login"
        className="fixed bottom-4 right-4 z-40 text-xs text-muted-foreground hover:text-foreground bg-background/70 backdrop-blur px-3 py-1.5 rounded-full border border-border"
      >
        Admin
      </Link>
    </div>
  );
}
