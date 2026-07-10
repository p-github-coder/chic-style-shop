import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Minus, Plus, Trash2, ShoppingBag, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/cart")({
  component: CartPage,
});

type CartRow = {
  id: string;
  quantity: number;
  product_id: string;
  products: {
    id: string;
    name: string;
    price: number;
    image_url: string;
  };
};

const DELIVERY_FEE = 9.99;

function CartPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: items, isLoading } = useQuery({
    queryKey: ["cart"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cart_items")
        .select("id, quantity, product_id, products(id, name, price, image_url)")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as unknown as CartRow[];
    },
  });

  const updateQty = useMutation({
    mutationFn: async ({ id, quantity }: { id: string; quantity: number }) => {
      if (quantity <= 0) {
        const { error } = await supabase.from("cart_items").delete().eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("cart_items").update({ quantity }).eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cart"] });
      qc.invalidateQueries({ queryKey: ["cart-count"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cart_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removed from cart");
      qc.invalidateQueries({ queryKey: ["cart"] });
      qc.invalidateQueries({ queryKey: ["cart-count"] });
    },
  });

  const subtotal = (items ?? []).reduce((s, it) => s + Number(it.products.price) * it.quantity, 0);
  const total = subtotal > 0 ? subtotal + DELIVERY_FEE : 0;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-4xl font-display font-extrabold mb-8">Your cart</h1>

      {isLoading ? (
        <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : !items || items.length === 0 ? (
        <div className="text-center py-24 bg-card border border-border rounded-3xl">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-accent text-primary mb-4">
            <ShoppingBag className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-semibold">Your cart is empty</h2>
          <p className="text-muted-foreground mt-1">Add something you love to get started.</p>
          <div className="mt-6 flex justify-center gap-2">
            <Button asChild className="rounded-full"><Link to="/shoes">Shop shoes</Link></Button>
            <Button asChild variant="outline" className="rounded-full"><Link to="/bags">Shop bags</Link></Button>
          </div>
        </div>
      ) : (
        <div className="grid lg:grid-cols-[1fr_360px] gap-6 items-start">
          <div className="space-y-3">
            {items.map((it) => (
              <div key={it.id} className="bg-card border border-border rounded-2xl p-4 flex gap-4 items-center">
                <img src={it.products.image_url} alt={it.products.name}
                  className="h-20 w-20 sm:h-24 sm:w-24 rounded-xl object-cover bg-muted shrink-0" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{it.products.name}</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">${Number(it.products.price).toFixed(2)}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <button onClick={() => updateQty.mutate({ id: it.id, quantity: it.quantity - 1 })}
                      className="h-8 w-8 rounded-full border border-border hover:bg-accent flex items-center justify-center" aria-label="Decrease">
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-8 text-center font-medium">{it.quantity}</span>
                    <button onClick={() => updateQty.mutate({ id: it.id, quantity: it.quantity + 1 })}
                      className="h-8 w-8 rounded-full border border-border hover:bg-accent flex items-center justify-center" aria-label="Increase">
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <div className="font-display font-bold">${(Number(it.products.price) * it.quantity).toFixed(2)}</div>
                  <button onClick={() => removeItem.mutate(it.id)}
                    className="text-muted-foreground hover:text-destructive p-1" aria-label="Remove">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-card border border-border rounded-2xl p-6 space-y-4 lg:sticky lg:top-24">
            <h2 className="font-display font-bold text-xl">Order summary</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Delivery</span><span>${DELIVERY_FEE.toFixed(2)}</span></div>
              <div className="border-t border-border pt-2 flex justify-between font-display font-bold text-lg">
                <span>Total</span><span>${total.toFixed(2)}</span>
              </div>
            </div>
            <Button onClick={() => navigate({ to: "/checkout" })} className="w-full h-11 rounded-full">
              Proceed to checkout
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
