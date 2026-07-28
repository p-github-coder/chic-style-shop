import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { ProductCard, type Product } from "@/components/ProductCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/category/$category")({
  ssr: false,
  component: CategoryPage,
});

type Sort = "featured" | "newest" | "price-asc" | "price-desc" | "rating";
type Row = Product & { created_at: string; featured: boolean; brand_id: string | null; subcategory_id: string | null };

function CategoryPage() {
  const { category: slug } = Route.useParams();
  const [brandId, setBrandId] = useState<string | null>(null);
  const [subId, setSubId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>("featured");

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

  const { data: products = [], isFetching } = useQuery({
    queryKey: ["category-products", category?.id],
    enabled: !!category?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, slug, name, description, price, image_url, images, rating, created_at, featured, brand_id, subcategory_id, brands(name, slug)")
        .eq("category_id", category!.id);
      if (error) throw error;
      return data as unknown as Row[];
    },
  });

  // Client-side, instant filtering — no page refresh needed.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = products.filter(
      (p) =>
        (brandId === null || p.brand_id === brandId) &&
        (subId === null || p.subcategory_id === subId) &&
        (q === "" || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)),
    );
    switch (sort) {
      case "newest": list = [...list].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)); break;
      case "price-asc": list = [...list].sort((a, b) => Number(a.price) - Number(b.price)); break;
      case "price-desc": list = [...list].sort((a, b) => Number(b.price) - Number(a.price)); break;
      case "rating": list = [...list].sort((a, b) => Number(b.rating) - Number(a.rating)); break;
      default: list = [...list].sort((a, b) => (a.featured === b.featured ? 0 : a.featured ? -1 : 1));
    }
    return list;
  }, [products, brandId, subId, search, sort]);

  const activeBrand = brands.find((b) => b.id === brandId);
  const activeSub = subs.find((s) => s.id === subId);
  const hasFilters = brandId !== null || subId !== null || search !== "";

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

  const chip = (active: boolean) =>
    `px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
      active ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-accent"
    }`;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-16">
        <section className="relative h-64 sm:h-80 overflow-hidden">
          <img src={category.hero_image} alt={category.name} className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-black/30" />
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 h-full flex flex-col justify-end pb-8 text-white">
            <div className="text-sm opacity-80"><Link to="/" className="hover:underline">Home</Link> / {category.name}</div>
            <h1 className="mt-2 text-4xl sm:text-6xl font-display font-extrabold">{category.name}</h1>
            <p className="mt-2 max-w-2xl opacity-90">{category.description}</p>
          </div>
        </section>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-8">
          {brands.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-3">Brand</h2>
              <div className="flex flex-wrap gap-2">
                <button className={chip(brandId === null)} onClick={() => setBrandId(null)}>All brands</button>
                {brands.map((b) => (
                  <button key={b.id} className={chip(brandId === b.id)} onClick={() => setBrandId(brandId === b.id ? null : b.id)}>
                    {b.name}
                  </button>
                ))}
              </div>
            </section>
          )}

          {subs.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-3">Type</h2>
              <div className="flex flex-wrap gap-2">
                <button className={chip(subId === null)} onClick={() => setSubId(null)}>All types</button>
                {subs.map((s) => (
                  <button key={s.id} className={chip(subId === s.id)} onClick={() => setSubId(subId === s.id ? null : s.id)}>
                    {s.name}
                  </button>
                ))}
              </div>
            </section>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search ${category.name.toLowerCase()}…`}
                className="pl-11 h-12 rounded-full"
              />
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="h-12 rounded-full border border-border bg-background px-5 text-sm"
            >
              <option value="featured">Featured</option>
              <option value="newest">Newest</option>
              <option value="rating">Highest rated</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
            </select>
            {hasFilters && (
              <Button variant="outline" className="h-12 rounded-full"
                onClick={() => { setBrandId(null); setSubId(null); setSearch(""); }}>
                <X className="h-4 w-4 mr-2" /> Clear
              </Button>
            )}
          </div>

          <div className="text-sm text-muted-foreground">
            Showing <span className="font-semibold text-foreground">{filtered.length}</span>{" "}
            {activeBrand ? `${activeBrand.name} ` : ""}
            {activeSub ? `${activeSub.name} ` : category.name.toLowerCase()} product{filtered.length === 1 ? "" : "s"}
          </div>

          {isFetching && products.length === 0 ? (
            <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-24 text-muted-foreground">No products match your filters.</div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {filtered.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
