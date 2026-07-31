import { useRef, useState } from "react";
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

  // Floating hearts spawned on "like" — purely visual, cleared after the animation.
  const [bursts, setBursts] = useState<{ id: number; drift: number }[]>([]);
  const seq = useRef(0);

  const wishKey = ["wishlist-has", authUser?.id ?? "anon", product.id];

  const { data: wished } = useQuery({
    // keyed per user so one customer never sees another customer's saves
    queryKey: wishKey,
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

  function spawnHearts() {
    const next = Array.from({ length: 3 }, (_, i) => ({
      id: ++seq.current,
      drift: (i - 1) * 14 + (Math.random() * 10 - 5),
    }));
    setBursts((b) => [...b, ...next]);
    setTimeout(() => setBursts((b) => b.filter((x) => !next.some((n) => n.id === x.id))), 1200);
  }

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
    // Instant feedback: flip the heart before the round-trip finishes.
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: wishKey });
      const prev = qc.getQueryData<boolean>(wishKey);
      qc.setQueryData(wishKey, !prev);
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx) qc.setQueryData(wishKey, ctx.prev);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: wishKey });
      qc.invalidateQueries({ queryKey: ["wishlist"] });
    },
  });

  return (
    <div className="group flex h-full flex-col bg-card rounded-2xl sm:rounded-3xl overflow-hidden border border-border hover:shadow-[var(--shadow-elevated)] transition-all duration-300 hover:-translate-y-1">
      <Link to="/product/$slug" params={{ slug: product.slug ?? "" }} className="block relative">
        <div className="aspect-square overflow-hidden bg-muted">
          <img
            src={product.image_url}
            alt={product.name}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            if (!wished) spawnHearts();
            toggleWish.mutate();
          }}
          className="absolute top-2 right-2 sm:top-3 sm:right-3 h-9 w-9 rounded-full bg-background/90 backdrop-blur flex items-center justify-center hover:bg-background active:scale-90 transition"
          aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}
        >
          <Heart
            className={`h-4 w-4 transition-colors ${wished ? "fill-primary text-primary heart-pop" : "text-foreground"}`}
          />
          {bursts.map((b) => (
            <Heart
              key={b.id}
              aria-hidden
              style={{ ["--drift" as any]: `${b.drift}px` }}
              className="heart-float pointer-events-none absolute left-1/2 top-0 h-5 w-5 fill-primary text-primary"
            />
          ))}
        </button>
      </Link>

      <div className="flex flex-1 flex-col p-3 sm:p-5">
        {product.brands?.name && (
          <div className="text-[10px] sm:text-[11px] font-medium tracking-widest uppercase text-muted-foreground mb-1 truncate">
            {product.brands.name}
          </div>
        )}
        <div className="flex items-start justify-between gap-2">
          <Link
            to="/product/$slug"
            params={{ slug: product.slug ?? "" }}
            className="min-w-0 font-display font-semibold text-sm sm:text-base leading-tight line-clamp-2 hover:text-primary"
          >
            {product.name}
          </Link>
          <div className="flex items-center gap-1 shrink-0 text-xs sm:text-sm">
            <Star className="h-3.5 w-3.5 sm:h-4 sm:w-4 fill-primary text-primary" />
            <span className="font-medium">{product.rating}</span>
          </div>
        </div>
        <p className="mt-1.5 hidden sm:line-clamp-2 text-sm text-muted-foreground sm:block">
          {product.description}
        </p>
        <div className="mt-3 sm:mt-4 flex flex-col gap-2 xs:flex-row sm:flex-row sm:items-center sm:justify-between">
          <span className="font-display font-bold text-base sm:text-lg">{formatNaira(product.price)}</span>
          <Button
            size="sm"
            onClick={() => addToCart.mutate()}
            disabled={addToCart.isPending}
            className="rounded-full w-full sm:w-auto active:scale-95 transition"
          >
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
