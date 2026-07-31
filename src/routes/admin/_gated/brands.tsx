import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Plus, Pencil, Trash2, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { upsertBrand, deleteBrand } from "@/lib/admin.functions";
import { SingleImageUploader } from "@/components/ImageUploader";

export const Route = createFileRoute("/admin/_gated/brands")({
  component: BrandsPage,
});

type Brand = { id: string; category_id: string; name: string; slug: string; logo_url: string };
type Cat = { id: string; name: string };

function BrandsPage() {
  const qc = useQueryClient();
  const upsert = useServerFn(upsertBrand);
  const del = useServerFn(deleteBrand);
  const [editing, setEditing] = useState<Partial<Brand> | null>(null);

  const { data: brands = [], isLoading } = useQuery({
    queryKey: ["admin", "brands"],
    queryFn: async () => (await supabase.from("brands").select("*").order("name")).data as Brand[],
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["admin", "categories-lite"],
    queryFn: async () => (await supabase.from("categories").select("id, name").order("sort_order")).data as Cat[],
  });

  const save = useMutation({
    mutationFn: (v: any) => upsert({ data: v }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "brands"] }); qc.invalidateQueries({ queryKey: ["admin", "metrics"] }); setEditing(null); toast.success("Saved"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "brands"] }); qc.invalidateQueries({ queryKey: ["admin", "metrics"] }); toast.success("Deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const byCat = new Map<string, Brand[]>();
  for (const b of brands) {
    const list = byCat.get(b.category_id) ?? [];
    list.push(b);
    byCat.set(b.category_id, list);
  }

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-extrabold">Brands</h1>
          <p className="text-muted-foreground mt-1">Manage brands within each category.</p>
        </div>
        <Button onClick={() => setEditing({ name: "", slug: "", logo_url: "", category_id: categories[0]?.id })}>
          <Plus className="h-4 w-4 mr-2" /> New brand
        </Button>
      </div>

      {isLoading ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : (
        <div className="space-y-6">
          {categories.map((c) => (
            <div key={c.id} className="bg-card border border-border rounded-2xl p-5">
              <h3 className="font-display font-bold text-lg mb-3">{c.name}</h3>
              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2">
                {(byCat.get(c.id) ?? []).map((b) => (
                  <div key={b.id} className="flex items-center gap-3 p-2 border border-border rounded-xl">
                    {b.logo_url ? <img loading="lazy" decoding="async" src={b.logo_url} alt="" className="h-8 w-8 rounded object-cover" /> : <div className="h-8 w-8 rounded bg-accent" />}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{b.name}</div>
                      <div className="text-[10px] text-muted-foreground truncate">/{b.slug}</div>
                    </div>
                    <button onClick={() => setEditing(b)}><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => confirm(`Delete ${b.name}?`) && remove.mutate(b.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
                  </div>
                ))}
                {(byCat.get(c.id) ?? []).length === 0 && <div className="text-xs text-muted-foreground col-span-full">No brands yet.</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-card rounded-3xl max-w-md w-full p-6 relative" onClick={(e) => e.stopPropagation()}>
            <button className="absolute top-4 right-4" onClick={() => setEditing(null)}><X className="h-5 w-5" /></button>
            <h2 className="font-display font-bold text-xl mb-4">{editing.id ? "Edit brand" : "New brand"}</h2>
            <form onSubmit={(e) => { e.preventDefault(); save.mutate({
              id: editing.id, name: editing.name, slug: editing.slug,
              logo_url: editing.logo_url ?? "", category_id: editing.category_id,
            }); }} className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase text-muted-foreground">Category</Label>
                <select value={editing.category_id ?? ""} onChange={(e) => setEditing({ ...editing, category_id: e.target.value })}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm" required>
                  <option value="">Select…</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5"><Label className="text-xs uppercase text-muted-foreground">Name</Label><Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} required /></div>
              <div className="space-y-1.5"><Label className="text-xs uppercase text-muted-foreground">Slug</Label><Input value={editing.slug ?? ""} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} required /></div>
              <div className="space-y-1.5"><Label className="text-xs uppercase text-muted-foreground">Logo</Label>
                <SingleImageUploader bucket="brand-logos" value={editing.logo_url ?? ""} onChange={(url) => setEditing({ ...editing, logo_url: url })} label="Logo" />
              </div>
              <Button type="submit" className="w-full">Save</Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
