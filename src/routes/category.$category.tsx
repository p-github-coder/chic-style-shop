import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { ProductCard, type Product } from "@/components/ProductCard";

export const Route = createFileRoute("/category/$category")({
  ssr: false,
  component: CategoryPage,
});

function CategoryPage() {
  const { category: slug } = Route.useParams();

  const { data: category, isLoading: catLoading } = useQuery({
    queryKey: ["category", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, slug, name, description, hero_image")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw notFound();
      return data;
    },
  });

  const { data: subs = [] } = useQuery({
    queryKey: ["subcategories", category?.id],
    enabled: !!category?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subcategories")
        .select("id, slug, name")
        .eq("category_id", category!.id)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const { data: brands = [] } = useQuery({
    queryKey: ["brands", category?.id],
    enabled: !!category?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brands")
        .select("id, slug, name")
        .eq("category_id", category!.id)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["category-products", category?.id],
    enabled: !!category?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, slug, name, description, price, image_url, images, rating, brands(name, slug)")
        .eq("category_id", category!.id)
        .order("rating", { ascending: false })
        .limit(12);
      if (error) throw error;
      return data as unknown as Product[];
    },
  });

  if (catLoading || !category) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex justify-center pt-32">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-16">
        {/* Hero */}
        <section className="relative h-64 sm:h-80 overflow-hidden">
          <img src={category.hero_image} alt={category.name} className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-black/30" />
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 h-full flex flex-col justify-end pb-8 text-white">
            <div className="text-sm opacity-80"><Link to="/" className="hover:underline">Home</Link> / {category.name}</div>
            <h1 className="mt-2 text-4xl sm:text-6xl font-display font-extrabold">{category.name}</h1>
            <p className="mt-2 max-w-2xl opacity-90">{category.description}</p>
          </div>
        </section>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-12">
          {/* Subcategories */}
          {subs.length > 0 && (
            <section>
              <h2 className="text-2xl font-display font-bold mb-4">Categories</h2>
              <div className="flex flex-wrap gap-2">
                {subs.map((s) => (
                  <div
                    key={s.id}
                    className="px-4 py-2 rounded-full bg-card border border-border text-sm"
                  >
                    {s.name}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Brands */}
          <section>
            <h2 className="text-2xl font-display font-bold mb-4">Shop by brand</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {brands.map((b) => (
                <Link
                  key={b.id}
                  to="/category/$category/$brand"
                  params={{ category: slug, brand: b.slug }}
                  className="group p-6 rounded-2xl bg-card border border-border hover:border-primary hover:shadow-[var(--shadow-elevated)] transition-all text-center"
                >
                  <div className="font-display font-bold text-lg">{b.name}</div>
                  <div className="mt-1 text-xs text-muted-foreground inline-flex items-center gap-1 justify-center">
                    Shop <ArrowRight className="h-3 w-3" />
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {/* Featured products */}
          {products.length > 0 && (
            <section>
              <h2 className="text-2xl font-display font-bold mb-4">Top picks in {category.name}</h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                {products.map((p) => <ProductCard key={p.id} product={p} />)}
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
