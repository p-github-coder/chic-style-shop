import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDown, ArrowUp, Loader2, Plus, Search, Star, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { formatNaira } from "@/lib/format";
import {
  setCollectionMembership,
  setProductRating,
  reorderCollection,
} from "@/lib/admin.functions";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";

type Row = {
  id: string;
  name: string;
  slug: string;
  price: number;
  image_url: string;
  rating: number;
  stock: number;
  home_sort: number;
  best_seller: boolean;
  new_arrival: boolean;
};

export function CollectionManager({
  field,
  title,
  subtitle,
}: {
  field: "new_arrival" | "best_seller";
  title: string;
  subtitle: string;
}) {
  const qc = useQueryClient();
  const setMember = useServerFn(setCollectionMembership);
  const setRating = useServerFn(setProductRating);
  const reorder = useServerFn(reorderCollection);
  const [q, setQ] = useState("");
  const [picker, setPicker] = useState(false);

  useRealtimeSync(["products"], [["admin", "collection", field]]);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["admin", "collection", field],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, slug, price, image_url, rating, stock, home_sort, best_seller, new_arrival")
        .order("home_sort")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Row[];
    },
  });

  const members = useMemo(() => products.filter((p) => p[field]), [products, field]);
  const candidates = useMemo(
    () =>
      products
        .filter((p) => !p[field])
        .filter((p) => (p.name + " " + p.slug).toLowerCase().includes(q.toLowerCase()))
        .slice(0, 40),
    [products, field, q],
  );

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin", "collection", field] });
    qc.invalidateQueries({ queryKey: ["admin", "products"] });
    qc.invalidateQueries({ queryKey: ["products"] });
  };

  const toggle = useMutation({
    mutationFn: (v: { id: string; value: boolean }) => setMember({ data: { ...v, field } }),
    onSuccess: (_d, v) => {
      invalidate();
      toast.success(v.value ? "Added to collection" : "Removed from collection");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rate = useMutation({
    mutationFn: (v: { id: string; rating: number }) => setRating({ data: v }),
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });

  const move = useMutation({
    mutationFn: (ids: string[]) => reorder({ data: { ids } }),
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });

  function shift(index: number, dir: -1 | 1) {
    const next = [...members];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    move.mutate(next.map((p) => p.id));
  }

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">
      <div className="mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-2xl sm:text-3xl font-display font-extrabold">{title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
        </div>
        <Button className="shrink-0" onClick={() => setPicker((p) => !p)}>
          <Plus className="h-4 w-4 mr-2" /> Add product
        </Button>
      </div>

      {picker && (
        <div className="mb-6 rounded-2xl border border-border bg-card p-4">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Search products to add…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="max-h-72 overflow-auto divide-y divide-border">
            {candidates.map((p) => (
              <div key={p.id} className="flex items-center gap-3 py-2">
                <img src={p.image_url} alt="" loading="lazy" className="h-10 w-10 rounded-lg object-cover shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{formatNaira(p.price)}</div>
                </div>
                <Button size="sm" variant="outline" onClick={() => toggle.mutate({ id: p.id, value: true })}>
                  Add
                </Button>
              </div>
            ))}
            {candidates.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">No matching products.</p>
            )}
          </div>
        </div>
      )}

      {isLoading ? (
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      ) : members.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center text-muted-foreground">
          Nothing in this collection yet — add products above and they appear on the homepage instantly.
        </div>
      ) : (
        <div className="space-y-3">
          {members.map((p, i) => (
            <div
              key={p.id}
              className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-2xl border border-border bg-card p-3 sm:flex sm:gap-4 sm:p-4"
            >
              <img src={p.image_url} alt="" loading="lazy" className="h-14 w-14 rounded-xl object-cover shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{p.name}</div>
                <div className="text-xs text-muted-foreground">
                  {formatNaira(p.price)} · stock {p.stock}
                </div>
              </div>
              <div className="col-span-2 flex flex-wrap items-center justify-between gap-2 sm:col-auto sm:justify-end">
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Star className="h-3.5 w-3.5 fill-primary text-primary" />
                  <Input
                    type="number"
                    min={0}
                    max={5}
                    step="0.1"
                    defaultValue={p.rating}
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (v !== p.rating) rate.mutate({ id: p.id, rating: v });
                    }}
                    className="h-9 w-20"
                  />
                </label>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="outline" disabled={i === 0} onClick={() => shift(i, -1)} aria-label="Move up">
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="outline" disabled={i === members.length - 1} onClick={() => shift(i, 1)} aria-label="Move down">
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => toggle.mutate({ id: p.id, value: false })} aria-label="Remove">
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
