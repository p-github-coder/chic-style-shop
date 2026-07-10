import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/checkout")({
  component: CheckoutPage,
});

type CartRow = {
  id: string;
  quantity: number;
  product_id: string;
  products: { id: string; name: string; price: number; image_url: string };
};

const DELIVERY_FEE = 9.99;

function CheckoutPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [payment, setPayment] = useState("card");
  const [success, setSuccess] = useState(false);

  const { data: items, isLoading } = useQuery({
    queryKey: ["cart"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cart_items")
        .select("id, quantity, product_id, products(id, name, price, image_url)");
      if (error) throw error;
      return data as unknown as CartRow[];
    },
  });

  const subtotal = (items ?? []).reduce((s, it) => s + Number(it.products.price) * it.quantity, 0);
  const total = subtotal + (subtotal > 0 ? DELIVERY_FEE : 0);

  const placeOrder = useMutation({
    mutationFn: async () => {
      if (!items || items.length === 0) throw new Error("Cart is empty");
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not signed in");

      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .insert({
          user_id: userData.user.id,
          customer_name: name,
          customer_email: email,
          shipping_address: address,
          payment_method: payment,
          subtotal,
          delivery_fee: DELIVERY_FEE,
          total,
        })
        .select()
        .single();
      if (orderErr) throw orderErr;

      const { error: itemsErr } = await supabase.from("order_items").insert(
        items.map((it) => ({
          order_id: order.id,
          product_id: it.product_id,
          product_name: it.products.name,
          product_image: it.products.image_url,
          quantity: it.quantity,
          price: Number(it.products.price),
        })),
      );
      if (itemsErr) throw itemsErr;

      const { error: clearErr } = await supabase
        .from("cart_items")
        .delete()
        .eq("user_id", userData.user.id);
      if (clearErr) throw clearErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cart"] });
      qc.invalidateQueries({ queryKey: ["cart-count"] });
      setSuccess(true);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (success) {
    return (
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-16 text-center">
        <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-accent text-primary mb-6">
          <CheckCircle2 className="h-12 w-12" />
        </div>
        <h1 className="text-4xl font-display font-extrabold">Order placed!</h1>
        <p className="mt-3 text-muted-foreground">
          Thanks {name || "friend"} — we've received your order and will email you shipping updates.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button asChild className="rounded-full"><Link to="/shoes">Continue shopping</Link></Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!items || items.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <h1 className="text-3xl font-display font-bold">Your cart is empty</h1>
        <Button asChild className="mt-6 rounded-full"><Link to="/shoes">Shop shoes</Link></Button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-4xl font-display font-extrabold mb-8">Checkout</h1>
      <form
        onSubmit={(e) => { e.preventDefault(); placeOrder.mutate(); }}
        className="grid lg:grid-cols-[1fr_360px] gap-6 items-start"
      >
        <div className="space-y-6">
          <section className="bg-card border border-border rounded-2xl p-6">
            <h2 className="font-display font-bold text-lg mb-4">Customer info</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </div>
          </section>

          <section className="bg-card border border-border rounded-2xl p-6">
            <h2 className="font-display font-bold text-lg mb-4">Shipping address</h2>
            <Textarea required value={address} onChange={(e) => setAddress(e.target.value)}
              placeholder="Street, city, state, ZIP, country" rows={3} />
          </section>

          <section className="bg-card border border-border rounded-2xl p-6">
            <h2 className="font-display font-bold text-lg mb-4">Payment method</h2>
            <RadioGroup value={payment} onValueChange={setPayment} className="space-y-2">
              {[
                { id: "card", label: "Credit / Debit Card" },
                { id: "paypal", label: "PayPal" },
                { id: "cod", label: "Cash on Delivery" },
              ].map((opt) => (
                <label key={opt.id} htmlFor={opt.id}
                  className="flex items-center gap-3 p-3 rounded-xl border border-border cursor-pointer hover:bg-accent transition-colors">
                  <RadioGroupItem value={opt.id} id={opt.id} />
                  <span className="font-medium">{opt.label}</span>
                </label>
              ))}
            </RadioGroup>
          </section>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 space-y-4 lg:sticky lg:top-24">
          <h2 className="font-display font-bold text-xl">Order summary</h2>
          <div className="space-y-3 max-h-64 overflow-auto">
            {items.map((it) => (
              <div key={it.id} className="flex items-center gap-3 text-sm">
                <img src={it.products.image_url} alt={it.products.name}
                  className="h-12 w-12 rounded-lg object-cover bg-muted" />
                <div className="flex-1 min-w-0">
                  <div className="truncate font-medium">{it.products.name}</div>
                  <div className="text-muted-foreground text-xs">Qty {it.quantity}</div>
                </div>
                <div className="font-medium">${(Number(it.products.price) * it.quantity).toFixed(2)}</div>
              </div>
            ))}
          </div>
          <div className="border-t border-border pt-3 space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Delivery</span><span>${DELIVERY_FEE.toFixed(2)}</span></div>
            <div className="flex justify-between font-display font-bold text-lg pt-1">
              <span>Total</span><span>${total.toFixed(2)}</span>
            </div>
          </div>
          <Button type="submit" disabled={placeOrder.isPending} className="w-full h-11 rounded-full">
            {placeOrder.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Place order"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => navigate({ to: "/cart" })} className="w-full rounded-full">
            Back to cart
          </Button>
        </div>
      </form>
    </div>
  );
}
