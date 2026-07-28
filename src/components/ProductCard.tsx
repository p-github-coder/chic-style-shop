import { Star, ShoppingBag, Loader2, Heart } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatNaira } from "@/lib/format";
import { useAuthUser } from "@/hooks/useAuthUser";

export type Product = {
  id: string;
  slug: string | null;
  name: string;
  description: string;
  price: number;
  image_url: string;
  images: string[];
  rating: number;
  brand_id?: string | null;
  brands?: { name: string; slug: string } | null;
};

export function ProductCard({ product }: { product: Product }) {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: authUser } = useAuthUser();

  const { data: wished } = useQuery({
    // keyed per user so one customer never sees another customer's saves
    queryKey: ["wishlist-has", authUser?.id ?? "anon", product.id],
    enabled: !!authUser?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("wishlist_items")
        .select("id")
        .eq("product_id", product.id)
        .eq("user_id", authUser!.id)
        .maybeSingle();
      return !!data;
    },
  });

  const addToCart = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        toast.info("Please sign in to add items to your cart");
        navigate({ to: "/login" });
        throw new Error("Not signed in");
      }
      const { data: existing } = await supabase
        .from("cart_items")
        .select("id, quantity")
        .eq("user_id", u.user.id)
        .eq("product_id", product.id)
        .maybeSingle();
      if (existing) {
        const { error } = await supabase
          .from("cart_items")
          .update({ quantity: existing.quantity + 1 })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("cart_items")
          .insert({ user_id: u.user.id, product_id: product.id, quantity: 1 });
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

  const toggleWish = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        toast.info("Please sign in to save items");
        navigate({ to: "/login" });
        throw new Error("Not signed in");
      }
      if (wished) {
        await supabase
          .from("wishlist_items")
          .delete()
          .eq("product_id", product.id)
          .eq("user_id", u.user.id);
      } else {
        await supabase
          .from("wishlist_items")
          .insert({ product_id: product.id, user_id: u.user.id });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wishlist-has", authUser?.id ?? "anon", product.id] });
      qc.invalidateQueries({ queryKey: ["wishlist"] });
    },
  });

  const href = product.slug ? `/product/${product.slug}` : "#";

  return (
    <div className="group bg-card rounded-3xl overflow-hidden border border-border hover:shadow-[var(--shadow-elevated)] transition-all duration-300 hover:-translate-y-1">
      <Link to="/product/$slug" params={{ slug: product.slug ?? "" }} className="block relative">
        <div className="aspect-square overflow-hidden bg-muted">
          <img
            src={product.image_url}
            alt={product.name}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            toggleWish.mutate();
          }}
          className="absolute top-3 right-3 h-9 w-9 rounded-full bg-background/90 backdrop-blur flex items-center justify-center hover:bg-background transition-colors"
          aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}
        >
          <Heart className={`h-4 w-4 ${wished ? "fill-primary text-primary" : "text-foreground"}`} />
        </button>
      </Link>
      <div className="p-5">
        {product.brands?.name && (
          <div className="text-[11px] font-medium tracking-widest uppercase text-muted-foreground mb-1">
            {product.brands.name}
          </div>
        )}
        <div className="flex items-start justify-between gap-2">
          <Link
            to="/product/$slug"
            params={{ slug: product.slug ?? "" }}
            className="font-display font-semibold text-base leading-tight line-clamp-1 hover:text-primary"
          >
            {product.name}
          </Link>
          <div className="flex items-center gap-1 shrink-0 text-sm">
            <Star className="h-4 w-4 fill-primary text-primary" />
            <span className="font-medium">{product.rating}</span>
          </div>
        </div>
        <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2 min-h-10">{product.description}</p>
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="font-display font-bold text-lg">{formatNaira(product.price)}</span>
          <Button size="sm" onClick={() => addToCart.mutate()} disabled={addToCart.isPending} className="rounded-full">
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
