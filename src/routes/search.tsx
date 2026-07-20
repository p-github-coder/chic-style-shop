import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search as SearchIcon, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { ProductCard, type Product } from "@/components/ProductCard";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/search")({
  ssr: false,
  component: SearchPage,
});

function SearchPage() {
  const [q, setQ] = useState("");

  const { data = [], isFetching } = useQuery({
    queryKey: ["search", q],
    enabled: q.length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, slug, name, description, price, image_url, images, rating, brands(name, slug)")
        .or(`name.ilike.%${q}%,description.ilike.%${q}%`)
        .limit(24);
      if (error) throw error;
      return data as unknown as Product[];
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-20 max-w-7xl mx-auto px-4 sm:px-6">
        <h1 className="text-4xl font-display font-extrabold mb-6">Search</h1>
        <div className="relative max-w-xl">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search bags, jewelry, watches…"
            className="pl-11 h-12 rounded-full"
          />
        </div>

        <div className="mt-10">
          {q.length < 2 ? (
            <div className="text-muted-foreground text-sm">Type at least 2 characters to search.</div>
          ) : isFetching ? (
            <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : data.length === 0 ? (
            <div className="text-muted-foreground py-12">No results for “{q}”.</div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {data.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
