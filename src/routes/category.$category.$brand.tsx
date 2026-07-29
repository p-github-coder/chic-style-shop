import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Loader2, Search, SlidersHorizontal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { ProductCard, type Product } from "@/components/ProductCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

type Sort = "featured" | "newest" | "price-asc" | "price-desc" | "rating";
type Filters = { type: string; q: string; sort: Sort };

export const Route = createFileRoute("/category/$category/$brand")({
  ssr: false,
  // Filters live in the URL so Brand + Type combinations are shareable.
  validateSearch: (search: Record<string, unknown>): Filters => ({
    type: typeof search.type === "string" ? search.type : "",
    q: typeof search.q === "string" ? search.q : "",
    sort: typeof search.sort === "string" ? (search.sort as Sort) : "featured",
  }),
  component: BrandPage,
});

function BrandPage() {
  const { category: catSlug, brand: brandSlug } = Route.useParams();
  const { type: subSlug, q: search, sort } = Route.useSearch();
  const navigate = useNavigate({ from: "/category/$category/$brand" });
  const setFilter = (patch: Partial<Filters>) =>
    navigate({ search: (prev: Filters) => ({ ...prev, ...patch }), replace: true });
  const [maxPrice, setMaxPrice] = useState<number>(20_000_000);
  const [showFilters, setShowFilters] = useState(false);


  const { data: ctx, isLoading } = useQuery({
    queryKey: ["brand-ctx", catSlug, brandSlug],
    queryFn: async () => {
      const { data: c } = await supabase
        .from("categories")
        .select("id, slug, name")
        .eq("slug", catSlug)
        .maybeSingle();
      if (!c) throw notFound();
      const { data: b } = await supabase
        .from("brands")
        .select("id, slug, name")
        .eq("category_id", c.id)
        .eq("slug", brandSlug)
        .maybeSingle();
      if (!b) throw notFound();
      return { category: c, brand: b };
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["brand-products", ctx?.brand.id],
    enabled: !!ctx?.brand.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, slug, name, description, price, image_url, images, rating, created_at, featured, subcategory_id, brands(name, slug)")
        .eq("brand_id", ctx!.brand.id);
      if (error) throw error;
      return data as unknown as (Product & { created_at: string; featured: boolean; subcategory_id: string | null })[];
    },
  });

  const { data: subs = [] } = useQuery({
    queryKey: ["subcategories", ctx?.category.id],
    enabled: !!ctx?.category.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subcategories")
        .select("id, slug, name")
        .eq("category_id", ctx!.category.id)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const subId = subs.find((s) => s.slug === subSlug)?.id ?? null;

  const filtered = useMemo(() => {
    let list = products.filter(
      (p) =>
        (subId === null || p.subcategory_id === subId) &&
        Number(p.price) <= maxPrice &&
        (search === "" ||
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          p.description.toLowerCase().includes(search.toLowerCase())),
    );
    switch (sort) {
      case "newest":
        list = [...list].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
        break;
      case "price-asc":
        list = [...list].sort((a, b) => Number(a.price) - Number(b.price));
        break;
      case "price-desc":
        list = [...list].sort((a, b) => Number(b.price) - Number(a.price));
        break;
      case "rating":
        list = [...list].sort((a, b) => Number(b.rating) - Number(a.rating));
        break;
      default:
        list = [...list].sort((a, b) => (a.featured === b.featured ? 0 : a.featured ? -1 : 1));
    }
    return list;
  }, [products, search, sort, maxPrice, subId]);

  // Only types this brand actually stocks are offered.
  const subCount = (id: string) => products.filter((p) => p.subcategory_id === id).length;


  if (isLoading || !ctx) {
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
      <main className="pt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="text-sm text-muted-foreground mb-3">
            <Link to="/" className="hover:underline">Home</Link>
            {" / "}
            <Link to="/category/$category" params={{ category: catSlug }} className="hover:underline">
              {ctx.category.name}
            </Link>
            {" / "}
            <span className="text-foreground">{ctx.brand.name}</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-display font-extrabold">{ctx.brand.name}</h1>
          <p className="mt-2 text-muted-foreground">
            All {ctx.brand.name} {ctx.category.name.toLowerCase()}.
          </p>

          {subs.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                onClick={() => setFilter({ type: "" })}
                className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                  subSlug === "" ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-accent"
                }`}
              >
                All types
              </button>
              {subs.map((s) => {
                const n = subCount(s.id);
                return (
                  <button
                    key={s.id}
                    disabled={n === 0 && subSlug !== s.slug}
                    onClick={() => setFilter({ type: subSlug === s.slug ? "" : s.slug })}
                    className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                      subSlug === s.slug ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-accent"
                    }`}
                  >
                    {s.name} <span className="opacity-60">({n})</span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setFilter({ q: e.target.value })}
                placeholder="Search this brand…"
                className="pl-11 h-12 rounded-full"
              />
            </div>
            <select
              value={sort}
              onChange={(e) => setFilter({ sort: e.target.value as Sort })}

              className="h-12 rounded-full border border-border bg-background px-5 text-sm"
            >
              <option value="featured">Featured</option>
              <option value="newest">Newest</option>
              <option value="rating">Highest rated</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
            </select>
            <Button variant="outline" onClick={() => setShowFilters((s) => !s)} className="h-12 rounded-full">
              <SlidersHorizontal className="h-4 w-4 mr-2" /> Filters
            </Button>
          </div>

          {showFilters && (
            <div className="mt-4 p-5 rounded-2xl bg-card border border-border">
              <div className="text-sm font-medium mb-3 flex items-center justify-between">
                <span>Max price</span>
                <span className="text-primary font-bold">
                  {new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(maxPrice)}
                </span>
              </div>
              <Slider
                value={[maxPrice]}
                min={5000}
                max={20_000_000}
                step={10_000}
                onValueChange={(v) => setMaxPrice(v[0])}
              />
            </div>
          )}

          <div className="mt-8">
            {filtered.length === 0 ? (
              <div className="text-center py-24 text-muted-foreground">
                No products match your filters.
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                {filtered.map((p) => <ProductCard key={p.id} product={p} />)}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
