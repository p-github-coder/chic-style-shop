import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Star, Heart, ShoppingBag, Truck, ShieldCheck, ChevronLeft, Loader2, CheckCircle2, XCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { ProductCard, type Product } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { formatNaira } from "@/lib/format";

export const Route = createFileRoute("/product/$slug")({
  ssr: false,
  component: ProductPage,
});

function ProductPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [activeImage, setActiveImage] = useState(0);
  const [color, setColor] = useState<string | null>(null);
  const [size, setSize] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [zoom, setZoom] = useState({ show: false, x: 50, y: 50 });

  // review form
  const [rvRating, setRvRating] = useState(5);
  const [rvTitle, setRvTitle] = useState("");
  const [rvBody, setRvBody] = useState("");

  const { data: product, isLoading } = useQuery({
    queryKey: ["product", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(
          "id, slug, name, description, price, image_url, images, colors, sizes, shades, stock, rating, specifications, ingredients, brand_id, category_id, subcategory_id, brands(id, name, slug), categories(name, slug), subcategories(name, slug)",
        )
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw notFound();
      return data;
    },
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ["reviews", product?.id],
    enabled: !!product?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select("id, rating, title, body, author_name, created_at")
        .eq("product_id", product!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: related = [] } = useQuery({
    queryKey: ["related", product?.brand_id, product?.id],
    enabled: !!product?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, slug, name, description, price, image_url, images, rating, brands(name, slug)")
        .eq("category_id", product!.category_id!)
        .neq("id", product!.id)
        .limit(4);
      if (error) throw error;
      return data as unknown as Product[];
    },
  });

  const { data: wished } = useQuery({
    queryKey: ["wishlist-has", product?.id],
    enabled: !!product?.id,
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return false;
      const { data } = await supabase
        .from("wishlist_items")
        .select("id")
        .eq("product_id", product!.id)
        .eq("user_id", u.user.id)
        .maybeSingle();
      return !!data;
    },
  });

  const gallery = useMemo(() => {
    if (!product) return [];
    const imgs = product.images && product.images.length > 0 ? product.images : [product.image_url];
    return Array.from(new Set(imgs));
  }, [product]);

  const avgRating = useMemo(() => {
    if (!reviews.length) return Number(product?.rating ?? 0);
    return reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
  }, [reviews, product]);

  const addToCart = useMutation({
    mutationFn: async () => {
      if (!product) return;
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
          .update({ quantity: existing.quantity + qty })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("cart_items")
          .insert({ user_id: u.user.id, product_id: product.id, quantity: qty });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(`${product?.name} added to cart`);
      qc.invalidateQueries({ queryKey: ["cart"] });
      qc.invalidateQueries({ queryKey: ["cart-count"] });
    },
    onError: (e: Error) => {
      if (e.message !== "Not signed in") toast.error(e.message);
    },
  });

  const buyNow = useMutation({
    mutationFn: async () => {
      await addToCart.mutateAsync();
    },
    onSuccess: () => navigate({ to: "/checkout" }),
  });

  const toggleWish = useMutation({
    mutationFn: async () => {
      if (!product) return;
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wishlist-has", product?.id] }),
  });

  const submitReview = useMutation({
    mutationFn: async () => {
      if (!product) return;
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        navigate({ to: "/login" });
        throw new Error("Not signed in");
      }
      if (!rvBody.trim()) throw new Error("Please write your review");
      const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", u.user.id).maybeSingle();
      const { error } = await supabase.from("reviews").upsert(
        {
          product_id: product.id,
          user_id: u.user.id,
          rating: rvRating,
          title: rvTitle,
          body: rvBody,
          author_name: profile?.full_name || u.user.email?.split("@")[0] || "Customer",
        },
        { onConflict: "product_id,user_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Thanks for your review!");
      setRvTitle("");
      setRvBody("");
      qc.invalidateQueries({ queryKey: ["reviews", product?.id] });
    },
    onError: (e: Error) => {
      if (e.message !== "Not signed in") toast.error(e.message);
    },
  });

  if (isLoading || !product) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex justify-center pt-32">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  const inStock = product.stock > 0;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-20 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          {/* Breadcrumb */}
          <div className="text-sm text-muted-foreground mb-4 flex items-center gap-1">
            <Link to="/" className="hover:underline">Home</Link>
            <span>/</span>
            {product.categories && (
              <>
                <Link to="/category/$category" params={{ category: product.categories.slug }} className="hover:underline">
                  {product.categories.name}
                </Link>
                <span>/</span>
              </>
            )}
            {product.brands && product.categories && (
              <Link
                to="/category/$category/$brand"
                params={{ category: product.categories.slug, brand: product.brands.slug }}
                className="hover:underline"
              >
                {product.brands.name}
              </Link>
            )}
          </div>

          <div className="grid lg:grid-cols-[1.1fr_1fr] gap-10">
            {/* Gallery */}
            <div>
              <div
                className="relative aspect-square overflow-hidden rounded-3xl bg-muted"
                onMouseEnter={() => setZoom((z) => ({ ...z, show: true }))}
                onMouseLeave={() => setZoom((z) => ({ ...z, show: false }))}
                onMouseMove={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  setZoom({
                    show: true,
                    x: ((e.clientX - r.left) / r.width) * 100,
                    y: ((e.clientY - r.top) / r.height) * 100,
                  });
                }}
              >
                <img
                  src={gallery[activeImage]}
                  alt={product.name}
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-300"
                  style={{
                    transformOrigin: `${zoom.x}% ${zoom.y}%`,
                    transform: zoom.show ? "scale(1.8)" : "scale(1)",
                  }}
                />
              </div>
              {gallery.length > 1 && (
                <div className="mt-3 grid grid-cols-5 gap-2">
                  {gallery.map((img, i) => (
                    <button
                      key={img + i}
                      onClick={() => setActiveImage(i)}
                      className={`aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                        i === activeImage ? "border-primary" : "border-transparent"
                      }`}
                    >
                      <img loading="lazy" decoding="async" src={img} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Info */}
            <div>
              {product.brands?.name && (
                <div className="text-xs font-medium tracking-widest uppercase text-primary mb-2">
                  {product.brands.name}
                </div>
              )}
              <h1 className="text-3xl sm:text-4xl font-display font-extrabold">{product.name}</h1>

              <div className="mt-3 flex items-center gap-3">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      className={`h-4 w-4 ${n <= Math.round(avgRating) ? "fill-primary text-primary" : "text-muted-foreground"}`}
                    />
                  ))}
                </div>
                <span className="text-sm text-muted-foreground">
                  {avgRating.toFixed(1)} · {reviews.length} review{reviews.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="mt-4 text-4xl font-display font-extrabold">{formatNaira(product.price)}</div>

              <div className="mt-3 flex items-center gap-2">
                {inStock ? (
                  <span className="inline-flex items-center gap-1 text-sm text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
                    <CheckCircle2 className="h-3.5 w-3.5" /> In stock · {product.stock} left
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-sm text-destructive bg-red-50 px-2.5 py-1 rounded-full">
                    <XCircle className="h-3.5 w-3.5" /> Out of stock
                  </span>
                )}
              </div>

              <p className="mt-5 text-muted-foreground leading-relaxed">{product.description}</p>

              {/* Colors */}
              {product.colors && product.colors.length > 0 && (
                <div className="mt-6">
                  <div className="text-sm font-medium mb-2">Color: <span className="text-muted-foreground">{color ?? "Choose"}</span></div>
                  <div className="flex flex-wrap gap-2">
                    {product.colors.map((c) => (
                      <button
                        key={c}
                        onClick={() => setColor(c)}
                        className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                          color === c ? "border-primary bg-accent" : "border-border hover:bg-accent/50"
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Sizes */}
              {product.sizes && product.sizes.length > 0 && (
                <div className="mt-4">
                  <div className="text-sm font-medium mb-2">Size: <span className="text-muted-foreground">{size ?? "Choose"}</span></div>
                  <div className="flex flex-wrap gap-2">
                    {product.sizes.map((s) => (
                      <button
                        key={s}
                        onClick={() => setSize(s)}
                        className={`min-w-12 px-3 py-1.5 rounded-full text-sm border transition-colors ${
                          size === s ? "border-primary bg-accent" : "border-border hover:bg-accent/50"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quantity */}
              <div className="mt-6 flex items-center gap-3">
                <div className="text-sm font-medium">Qty</div>
                <div className="inline-flex items-center border border-border rounded-full">
                  <button className="h-9 w-9 hover:bg-accent rounded-l-full" onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
                  <span className="w-10 text-center font-medium">{qty}</span>
                  <button className="h-9 w-9 hover:bg-accent rounded-r-full" onClick={() => setQty((q) => Math.min(product.stock || 99, q + 1))}>+</button>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2">
                <Button
                  onClick={() => addToCart.mutate()}
                  disabled={!inStock || addToCart.isPending}
                  className="h-12 rounded-full text-base"
                >
                  {addToCart.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><ShoppingBag className="h-4 w-4 mr-2" /> Add to Cart</>}
                </Button>
                <Button
                  onClick={() => buyNow.mutate()}
                  disabled={!inStock || buyNow.isPending}
                  variant="secondary"
                  className="h-12 rounded-full text-base"
                >
                  Buy Now
                </Button>
                <Button
                  onClick={() => toggleWish.mutate()}
                  variant="outline"
                  size="icon"
                  className="h-12 w-12 rounded-full"
                  aria-label="Wishlist"
                >
                  <Heart className={`h-5 w-5 ${wished ? "fill-primary text-primary" : ""}`} />
                </Button>
              </div>

              {/* Perks */}
              <div className="mt-6 space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Truck className="h-4 w-4 text-primary" /> Free delivery on orders over ₦50,000
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <ShieldCheck className="h-4 w-4 text-primary" /> 100% authentic · Secure checkout
                </div>
              </div>
            </div>
          </div>

          {/* Specifications */}
          {product.specifications && Object.keys(product.specifications as Record<string, unknown>).length > 0 && (
            <section className="mt-16">
              <h2 className="text-2xl font-display font-bold mb-4">Specifications</h2>
              <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-3 bg-card border border-border rounded-2xl p-6">
                {Object.entries(product.specifications as Record<string, string>).map(([k, v]) => (
                  <div key={k} className="flex justify-between border-b border-border pb-2 text-sm">
                    <dt className="text-muted-foreground capitalize">{k}</dt>
                    <dd className="font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {product.ingredients && (
            <section className="mt-12">
              <h2 className="text-2xl font-display font-bold mb-3">Ingredients</h2>
              <p className="text-muted-foreground text-sm leading-relaxed bg-card border border-border rounded-2xl p-6">
                {product.ingredients}
              </p>
            </section>
          )}

          {/* Reviews */}
          <section className="mt-16">
            <h2 className="text-2xl font-display font-bold mb-6">Customer reviews</h2>
            <div className="grid lg:grid-cols-[1fr_1.4fr] gap-8">
              <form
                onSubmit={(e) => { e.preventDefault(); submitReview.mutate(); }}
                className="bg-card border border-border rounded-2xl p-6 space-y-4 h-fit"
              >
                <div className="font-display font-bold">Write a review</div>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" onClick={() => setRvRating(n)}>
                      <Star className={`h-6 w-6 ${n <= rvRating ? "fill-primary text-primary" : "text-muted-foreground"}`} />
                    </button>
                  ))}
                </div>
                <Input placeholder="Title (optional)" value={rvTitle} onChange={(e) => setRvTitle(e.target.value)} />
                <Textarea placeholder="Share your experience…" rows={4} value={rvBody} onChange={(e) => setRvBody(e.target.value)} required />
                <Button type="submit" disabled={submitReview.isPending} className="w-full rounded-full">
                  {submitReview.isPending ? "Submitting…" : "Submit review"}
                </Button>
              </form>

              <div className="space-y-4">
                {reviews.length === 0 && (
                  <div className="text-muted-foreground text-sm">No reviews yet. Be the first to share your thoughts.</div>
                )}
                {reviews.map((r) => (
                  <div key={r.id} className="bg-card border border-border rounded-2xl p-5">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">{r.author_name || "Customer"}</div>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star key={n} className={`h-4 w-4 ${n <= r.rating ? "fill-primary text-primary" : "text-muted-foreground"}`} />
                        ))}
                      </div>
                    </div>
                    {r.title && <div className="mt-1 font-medium">{r.title}</div>}
                    <p className="mt-1 text-sm text-muted-foreground">{r.body}</p>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Related */}
          {related.length > 0 && (
            <section className="mt-16">
              <h2 className="text-2xl font-display font-bold mb-6">You may also like</h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                {related.map((p) => <ProductCard key={p.id} product={p} />)}
              </div>
            </section>
          )}

          <div className="mt-16">
            <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <ChevronLeft className="h-4 w-4" /> Continue shopping
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
