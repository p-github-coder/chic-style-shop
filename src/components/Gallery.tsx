import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, SlidersHorizontal, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ProductCard, type Product } from "@/components/ProductCard";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";

export function Gallery({ type, title, subtitle }: { type: "shoes" | "bags"; title: string; subtitle: string }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [priceMax, setPriceMax] = useState<number>(500);
  const [showFilters, setShowFilters] = useState(false);

  const { data: products, isLoading } = useQuery({
    queryKey: ["products", type],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("type", type)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Product[];
    },
  });

  const categories = useMemo(() => {
    if (!products) return [];
    return Array.from(new Set(products.map((p) => p.category)));
  }, [products]);

  const filtered = useMemo(() => {
    if (!products) return [];
    return products.filter((p) => {
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase())
        || p.description.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = category === "all" || p.category === category;
      const matchesPrice = Number(p.price) <= priceMax;
      return matchesSearch && matchesCategory && matchesPrice;
    });
  }, [products, search, category, priceMax]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <h1 className="text-4xl sm:text-5xl font-display font-extrabold">{title}</h1>
        <p className="mt-2 text-muted-foreground text-lg">{subtitle}</p>
      </div>

      <div className="mb-6 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${type}…`} className="pl-11 h-12 rounded-full" />
        </div>
        <Button variant="outline" onClick={() => setShowFilters((s) => !s)}
          className="h-12 rounded-full">
          <SlidersHorizontal className="h-4 w-4 mr-2" /> Filters
        </Button>
      </div>

      {showFilters && (
        <div className="mb-6 p-5 rounded-2xl bg-card border border-border grid sm:grid-cols-2 gap-6">
          <div>
            <div className="text-sm font-medium mb-3">Category</div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setCategory("all")}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  category === "all" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent"
                }`}>All</button>
              {categories.map((c) => (
                <button key={c} onClick={() => setCategory(c)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                    category === c ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent"
                  }`}>{c}</button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-sm font-medium mb-3 flex items-center justify-between">
              <span>Max price</span>
              <span className="text-primary font-bold">${priceMax}</span>
            </div>
            <Slider value={[priceMax]} min={0} max={500} step={10}
              onValueChange={(v) => setPriceMax(v[0])} />
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-24 text-muted-foreground">No products match your filters.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filtered.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      )}
    </div>
  );
}
