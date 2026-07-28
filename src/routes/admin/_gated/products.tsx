import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, X, Loader2, Search, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { upsertProduct, deleteProduct } from "@/lib/admin.functions";
import { SingleImageUploader, MultiImageUploader } from "@/components/ImageUploader";
import { formatNaira } from "@/lib/format";

export const Route = createFileRoute("/admin/_gated/products")({
  component: ProductsPage,
});

type Product = {
  id: string;
  slug: string;
  name: string;
  description: string;
  price: number;
  image_url: string;
  images: string[];
  stock: number;
  category_id: string | null;
  subcategory_id: string | null;
  brand_id: string | null;
  colors: string[];
  sizes: string[];
  best_seller: boolean;
  new_arrival: boolean;
  featured: boolean;
};

function stockBadge(stock: number) {
  if (stock <= 0) return <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">Out of stock</span>;
  if (stock <= 5) return <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">Low stock</span>;
  return <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">In stock</span>;
}

function ProductsPage() {
  const qc = useQueryClient();
  const upsert = useServerFn(upsertProduct);
  const del = useServerFn(deleteProduct);
  const [editing, setEditing] = useState<Partial<Product> | null>(null);
  const [q, setQ] = useState("");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [stockFilter, setStockFilter] = useState<"all" | "in" | "low" | "out">("all");

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["admin", "products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products")
        .select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Product[];
    },
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["admin", "categories-lite"],
    queryFn: async () => (await supabase.from("categories").select("id, name, slug").order("sort_order")).data ?? [],
  });
  const { data: subcategories = [] } = useQuery({
    queryKey: ["admin", "subcategories-lite"],
    queryFn: async () => (await supabase.from("subcategories").select("id, name, category_id")).data ?? [],
  });
  const { data: brands = [] } = useQuery({
    queryKey: ["admin", "brands-lite"],
    queryFn: async () => (await supabase.from("brands").select("id, name, category_id")).data ?? [],
  });

  const save = useMutation({
    mutationFn: (v: any) => upsert({ data: v }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "products"] }); qc.invalidateQueries({ queryKey: ["admin", "metrics"] }); setEditing(null); toast.success("Product saved"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "products"] }); qc.invalidateQueries({ queryKey: ["admin", "metrics"] }); toast.success("Deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const catName = useMemo(() => new Map((categories as any[]).map((c) => [c.id, c.name])), [categories]);
  const brandName = useMemo(() => new Map((brands as any[]).map((b) => [b.id, b.name])), [brands]);

  const filtered = products.filter((p) => {
    const s = p.stock;
    const okStock =
      stockFilter === "all" ||
      (stockFilter === "in" && s > 5) ||
      (stockFilter === "low" && s > 0 && s <= 5) ||
      (stockFilter === "out" && s <= 0);
    const okCat = catFilter === "all" || p.category_id === catFilter;
    const okQ = (p.name + " " + p.slug).toLowerCase().includes(q.toLowerCase());
    return okStock && okCat && okQ;
  });

  const lowCount = products.filter((p) => p.stock > 0 && p.stock <= 5).length;
  const outCount = products.filter((p) => p.stock <= 0).length;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-display font-extrabold">Products</h1>
          <p className="text-muted-foreground mt-1">Add, edit, and manage inventory in Nigerian Naira (₦).</p>
        </div>
        <Button onClick={() => setEditing({
          name: "", slug: "", description: "", price: 0, stock: 0,
          image_url: "", images: [], colors: [], sizes: [],
          category_id: (categories as any[])[0]?.id ?? null,
          brand_id: null, subcategory_id: null,
          best_seller: false, new_arrival: false, featured: false,
        })}>
          <Plus className="h-4 w-4 mr-2" /> New product
        </Button>
      </div>

      {(lowCount > 0 || outCount > 0) && (
        <div className="mb-4 flex items-center gap-2 text-sm p-3 rounded-xl bg-amber-50 text-amber-900 border border-amber-200">
          <AlertTriangle className="h-4 w-4" />
          {outCount > 0 && <span><strong>{outCount}</strong> out of stock</span>}
          {outCount > 0 && lowCount > 0 && <span>·</span>}
          {lowCount > 0 && <span><strong>{lowCount}</strong> low stock</span>}
        </div>
      )}

      <div className="mb-4 flex gap-3 flex-wrap items-center">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search products…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9 w-64" />
        </div>
        <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}
          className="h-10 px-3 rounded-md border border-input bg-background text-sm">
          <option value="all">All categories</option>
          {(categories as any[]).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {(["all", "in", "low", "out"] as const).map((f) => (
          <button key={f} onClick={() => setStockFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize ${
              stockFilter === f ? "bg-primary text-primary-foreground" : "bg-card border border-border hover:bg-accent"
            }`}>{f === "in" ? "In stock" : f === "low" ? "Low" : f === "out" ? "Out" : "All"}</button>
        ))}
      </div>

      {isLoading ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-accent">
                <tr>
                  <th className="text-left p-3">Product</th>
                  <th className="text-left p-3">Category</th>
                  <th className="text-left p-3">Brand</th>
                  <th className="text-right p-3">Price</th>
                  <th className="text-right p-3">Stock</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-right p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        {p.image_url ? <img src={p.image_url} alt="" className="h-10 w-10 rounded-lg object-cover" /> : <div className="h-10 w-10 rounded-lg bg-accent" />}
                        <div>
                          <div className="font-medium">{p.name}</div>
                          <div className="text-[10px] text-muted-foreground">/{p.slug}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-xs">{catName.get(p.category_id ?? "") ?? "—"}</td>
                    <td className="p-3 text-xs">{brandName.get(p.brand_id ?? "") ?? "—"}</td>
                    <td className="p-3 text-right">{formatNaira(p.price)}</td>
                    <td className="p-3 text-right">{p.stock}</td>
                    <td className="p-3">{stockBadge(p.stock)}</td>
                    <td className="p-3">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="outline" onClick={() => setEditing(p)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => confirm(`Delete ${p.name}?`) && remove.mutate(p.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No products found.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editing && (
        <ProductModal
          product={editing}
          categories={categories as any[]}
          subcategories={subcategories as any[]}
          brands={brands as any[]}
          onClose={() => setEditing(null)}
          onSave={(v) => save.mutate(v)}
          saving={save.isPending}
        />
      )}
    </div>
  );
}

function ProductModal({
  product, categories, subcategories, brands, onClose, onSave, saving,
}: {
  product: Partial<Product>;
  categories: { id: string; name: string }[];
  subcategories: { id: string; name: string; category_id: string }[];
  brands: { id: string; name: string; category_id: string }[];
  onClose: () => void;
  onSave: (v: any) => void;
  saving: boolean;
}) {
  const [p, setP] = useState<Partial<Product>>(product);
  const set = <K extends keyof Product>(k: K, v: Product[K]) => setP((s) => ({ ...s, [k]: v }));

  const subs = subcategories.filter((s) => s.category_id === p.category_id);
  const brs = brands.filter((b) => b.category_id === p.category_id);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const slug = (p.slug ?? "").trim() ||
      (p.name ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    onSave({
      id: p.id,
      name: (p.name ?? "").trim(),
      slug,
      description: p.description ?? "",
      price: Number(p.price ?? 0),
      image_url: p.image_url ?? "",
      images: p.images ?? [],
      stock: Number(p.stock ?? 0),
      category_id: p.category_id ?? null,
      subcategory_id: p.subcategory_id ?? null,
      brand_id: p.brand_id ?? null,
      colors: p.colors ?? [],
      sizes: p.sizes ?? [],
      best_seller: !!p.best_seller,
      new_arrival: !!p.new_arrival,
      featured: !!p.featured,
    });
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-auto p-6 relative" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="absolute top-4 right-4" onClick={onClose}><X className="h-5 w-5" /></button>
        <h2 className="font-display font-bold text-xl mb-4">{p.id ? "Edit product" : "New product"}</h2>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Name"><Input value={p.name ?? ""} onChange={(e) => set("name", e.target.value)} required /></Field>
            <Field label="Slug"><Input value={p.slug ?? ""} onChange={(e) => set("slug", e.target.value)} placeholder="auto from name" /></Field>
          </div>
          <Field label="Description">
            <Textarea rows={3} value={p.description ?? ""} onChange={(e) => set("description", e.target.value)} />
          </Field>
          <div className="grid sm:grid-cols-3 gap-4">
            <Field label="Price (₦)">
              <Input type="number" min={0} step="0.01" value={p.price ?? 0} onChange={(e) => set("price", Number(e.target.value))} required />
            </Field>
            <Field label="Stock quantity">
              <Input type="number" min={0} value={p.stock ?? 0} onChange={(e) => set("stock", Number(e.target.value))} required />
            </Field>
            <div className="flex flex-col gap-2 pt-6">
              <label className="text-xs flex items-center gap-2"><input type="checkbox" checked={!!p.best_seller} onChange={(e) => set("best_seller", e.target.checked)} /> Best seller</label>
              <label className="text-xs flex items-center gap-2"><input type="checkbox" checked={!!p.new_arrival} onChange={(e) => set("new_arrival", e.target.checked)} /> New arrival</label>
              <label className="text-xs flex items-center gap-2"><input type="checkbox" checked={!!p.featured} onChange={(e) => set("featured", e.target.checked)} /> Featured</label>
            </div>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <Field label="Category">
              <select value={p.category_id ?? ""} onChange={(e) => { set("category_id", e.target.value || null as any); set("subcategory_id", null as any); set("brand_id", null as any); }}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm">
                <option value="">—</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Subcategory">
              <select value={p.subcategory_id ?? ""} onChange={(e) => set("subcategory_id", (e.target.value || null) as any)}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm" disabled={!subs.length}>
                <option value="">—</option>
                {subs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="Brand">
              <select value={p.brand_id ?? ""} onChange={(e) => set("brand_id", (e.target.value || null) as any)}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm" disabled={!brs.length}>
                <option value="">—</option>
                {brs.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Cover image">
            <SingleImageUploader bucket="product-images" value={p.image_url ?? ""} onChange={(u) => set("image_url", u)} label="Cover" />
          </Field>
          <Field label="Gallery images">
            <MultiImageUploader value={p.images ?? []} onChange={(u) => set("images", u)} />
          </Field>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Colors (comma-separated)">
              <Input value={(p.colors ?? []).join(", ")} onChange={(e) => set("colors", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} />
            </Field>
            <Field label="Sizes (comma-separated)">
              <Input value={(p.sizes ?? []).join(", ")} onChange={(e) => set("sizes", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} />
            </Field>
          </div>
          <Button type="submit" disabled={saving} className="w-full">
            {saving ? "Saving…" : p.id ? "Update product" : "Create product"}
          </Button>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
