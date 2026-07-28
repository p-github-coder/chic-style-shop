import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Heart, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser } from "@/hooks/useAuthUser";
import { Navbar } from "@/components/Navbar";
import { ProductCard, type Product } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/wishlist")({
  ssr: false,
  component: WishlistPage,
});

function WishlistPage() {
  const { data: authUser, isLoading: authLoading } = useAuthUser();
  const signedIn = authLoading ? null : !!authUser;

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["wishlist", authUser?.id ?? "anon"],
    enabled: !!authUser?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wishlist_items")
        .select("product_id, products(id, slug, name, description, price, image_url, images, rating, brands(name, slug))")
        .eq("user_id", authUser!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => r.products).filter(Boolean) as unknown as Product[];
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-20 max-w-7xl mx-auto px-4 sm:px-6">
        <h1 className="text-4xl font-display font-extrabold mb-8">Your wishlist</h1>

        {signedIn === false ? (
          <div className="text-center py-24 bg-card border border-border rounded-3xl">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-accent text-primary mb-4">
              <Heart className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-semibold">Sign in to see your saved items</h2>
            <div className="mt-6">
              <Button asChild className="rounded-full"><Link to="/login">Sign in</Link></Button>
            </div>
          </div>
        ) : isLoading || signedIn === null ? (
          <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : items.length === 0 ? (
          <div className="text-center py-24 bg-card border border-border rounded-3xl">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-accent text-primary mb-4">
              <Heart className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-semibold">Your wishlist is empty</h2>
            <p className="text-muted-foreground mt-1">Tap the heart on any product to save it here.</p>
            <div className="mt-6">
              <Button asChild className="rounded-full"><Link to="/">Continue shopping</Link></Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {items.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </main>
    </div>
  );
}
