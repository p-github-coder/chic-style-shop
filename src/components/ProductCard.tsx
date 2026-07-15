import { Star, ShoppingBag, Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url: string;
  rating: number;
  category: string;
  type: "shoes" | "bags";
};

export function ProductCard({ product }: { product: Product }) {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const addToCart = useMutation({
    mutationFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        toast.info("Please sign in to add items to your cart");
        navigate({ to: "/login" });
        throw new Error("Not signed in");
      }

      const { data: existing } = await supabase
        .from("cart_items")
        .select("id, quantity")
        .eq("user_id", user.user.id)
        .eq("product_id", product.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("cart_items")
          .update({ quantity: existing.quantity + 1 })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("cart_items").insert({
          user_id: user.user.id,
          product_id: product.id,
          quantity: 1,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(`${product.name} added to cart`);
      qc.invalidateQueries({ queryKey: ["cart"] });
      qc.invalidateQueries({ queryKey: ["cart-count"] });
    },
    onError: (e: Error) => {
      if (e.message !== "Not signed in") toast.error(e.message);
    },
  });

  return (
    <div className="group bg-card rounded-3xl overflow-hidden border border-border hover:shadow-[var(--shadow-elevated)] transition-all duration-300 hover:-translate-y-1">
      <div className="aspect-square overflow-hidden bg-muted">
        <img src={product.image_url} alt={product.name} loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
      </div>
      <div className="p-5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display font-semibold text-lg leading-tight truncate">{product.name}</h3>
          <div className="flex items-center gap-1 shrink-0 text-sm">
            <Star className="h-4 w-4 fill-primary text-primary" />
            <span className="font-medium">{product.rating}</span>
          </div>
        </div>
        <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2 min-h-10">{product.description}</p>
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="font-display font-bold text-xl">${product.price.toFixed(2)}</span>
          <Button size="sm" onClick={() => addToCart.mutate()} disabled={addToCart.isPending}
            className="rounded-full">
            {addToCart.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <><ShoppingBag className="h-4 w-4 mr-1.5" /> Add</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
