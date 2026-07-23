import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Plus, Pencil, Trash2, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { upsertCategory, deleteCategory, upsertSubcategory, deleteSubcategory } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/_gated/categories")({
  component: CategoriesPage,
});

type Cat = { id: string; slug: string; name: string; description: string; hero_image: string; icon: string; sort_order: number };
type Sub = { id: string; category_id: string; slug: string; name: string };

function CategoriesPage() {
  const qc = useQueryClient();
  const upsert = useServerFn(upsertCategory);
  const del = useServerFn(deleteCategory);
  const upsertSub = useServerFn(upsertSubcategory);
  const delSub = useServerFn(deleteSubcategory);

  const [editing, setEditing] = useState<Partial<Cat> | null>(null);
  const [subEditing, setSubEditing] = useState<{ category_id: string; sub?: Partial<Sub> } | null>(null);

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["admin", "categories"],
    queryFn: async () => (await supabase.from("categories").select("*").order("sort_order")).data as Cat[],
  });
  const { data: subs = [] } = useQuery({
    queryKey: ["admin", "subcategories"],
    queryFn: async () => (await supabase.from("subcategories").select("*").order("name")).data as Sub[],
  });

  const save = useMutation({
    mutationFn: (v: any) => upsert({ data: v }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "categories"] }); qc.invalidateQueries({ queryKey: ["categories"] }); setEditing(null); toast.success("Saved"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "categories"] }); toast.success("Deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const saveSub = useMutation({
    mutationFn: (v: any) => upsertSub({ data: v }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "subcategories"] }); setSubEditing(null); toast.success("Saved"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const removeSub = useMutation({
    mutationFn: (id: string) => delSub({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "subcategories"] }); toast.success("Deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-extrabold">Categories</h1>
          <p className="text-muted-foreground mt-1">Organize the shop's top-level structure.</p>
        </div>
        <Button onClick={() => setEditing({ name: "", slug: "", description: "", hero_image: "", icon: "", sort_order: (categories.length + 1) * 10 })}>
          <Plus className="h-4 w-4 mr-2" /> New category
        </Button>
      </div>

      {isLoading ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : (
        <div className="space-y-4">
          {categories.map((c) => (
            <div key={c.id} className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-start gap-4">
                {c.hero_image && <img src={c.hero_image} alt="" className="h-16 w-16 rounded-xl object-cover" />}
                <div className="flex-1 min-w-0">
                  <div className="font-display font-bold text-lg">{c.name}</div>
                  <div className="text-xs text-muted-foreground">/{c.slug} · sort {c.sort_order}</div>
                  <div className="text-sm text-muted-foreground mt-1 line-clamp-2">{c.description}</div>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => setEditing(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="destructive" onClick={() => confirm(`Delete ${c.name}?`) && remove.mutate(c.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-border">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-semibold uppercase text-muted-foreground">Subcategories</div>
                  <Button size="sm" variant="ghost" onClick={() => setSubEditing({ category_id: c.id, sub: { name: "", slug: "", category_id: c.id } })}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {subs.filter((s) => s.category_id === c.id).map((s) => (
                    <div key={s.id} className="inline-flex items-center gap-1 bg-accent rounded-full px-3 py-1 text-xs">
                      <span>{s.name}</span>
                      <button onClick={() => setSubEditing({ category_id: c.id, sub: s })}><Pencil className="h-3 w-3" /></button>
                      <button onClick={() => confirm(`Delete ${s.name}?`) && removeSub.mutate(s.id)}><X className="h-3 w-3" /></button>
                    </div>
                  ))}
                  {subs.filter((s) => s.category_id === c.id).length === 0 && (
                    <span className="text-xs text-muted-foreground">No subcategories.</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <Modal title={editing.id ? "Edit category" : "New category"} onClose={() => setEditing(null)}>
          <form onSubmit={(e) => { e.preventDefault(); save.mutate({
            id: editing.id, name: editing.name, slug: editing.slug, description: editing.description ?? "",
            hero_image: editing.hero_image ?? "", icon: editing.icon ?? "", sort_order: Number(editing.sort_order ?? 0),
          }); }} className="space-y-3">
            <Field label="Name"><Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} required /></Field>
            <Field label="Slug"><Input value={editing.slug ?? ""} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} required /></Field>
            <Field label="Description"><Textarea value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></Field>
            <Field label="Hero image URL"><Input value={editing.hero_image ?? ""} onChange={(e) => setEditing({ ...editing, hero_image: e.target.value })} /></Field>
            <Field label="Sort order"><Input type="number" value={editing.sort_order ?? 0} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} /></Field>
            <Button type="submit" className="w-full">Save</Button>
          </form>
        </Modal>
      )}

      {subEditing && (
        <Modal title={subEditing.sub?.id ? "Edit subcategory" : "New subcategory"} onClose={() => setSubEditing(null)}>
          <form onSubmit={(e) => { e.preventDefault(); saveSub.mutate({
            id: subEditing.sub?.id, category_id: subEditing.category_id,
            name: subEditing.sub?.name ?? "", slug: subEditing.sub?.slug ?? "",
          }); }} className="space-y-3">
            <Field label="Name"><Input value={subEditing.sub?.name ?? ""} onChange={(e) => setSubEditing({ ...subEditing, sub: { ...subEditing.sub!, name: e.target.value } })} required /></Field>
            <Field label="Slug"><Input value={subEditing.sub?.slug ?? ""} onChange={(e) => setSubEditing({ ...subEditing, sub: { ...subEditing.sub!, slug: e.target.value } })} required /></Field>
            <Button type="submit" className="w-full">Save</Button>
          </form>
        </Modal>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>{children}</div>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-3xl max-w-lg w-full max-h-[85vh] overflow-auto p-6 relative" onClick={(e) => e.stopPropagation()}>
        <button className="absolute top-4 right-4" onClick={onClose}><X className="h-5 w-5" /></button>
        <h2 className="font-display font-bold text-xl mb-4">{title}</h2>
        {children}
      </div>
    </div>
  );
}
