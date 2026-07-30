import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Heart, ShoppingCart, Loader2, TrendingUp } from "lucide-react";
import { getCustomerActivity } from "@/lib/admin.functions";
import { formatNaira } from "@/lib/format";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";

export const Route = createFileRoute("/admin/_gated/activity")({
  component: ActivityPage,
});

function ActivityPage() {
  const fetchActivity = useServerFn(getCustomerActivity);

  // Wishlist and cart changes stream in live.
  useRealtimeSync(["wishlist_items", "cart_items", "products"], [["admin", "activity"], ["admin", "metrics"]]);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "activity"],
    queryFn: () => fetchActivity({}),
    refetchInterval: 30_000,
  });


  const cards = [
    { label: "Wishlist saves", value: data?.wishlist.length ?? 0, icon: Heart },
    { label: "Items in carts", value: data?.cart.length ?? 0, icon: ShoppingCart },
    { label: "Cart value", value: formatNaira(data?.cartValue ?? 0), icon: TrendingUp },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-display font-extrabold">Customer activity</h1>
        <p className="text-muted-foreground mt-1">Live wishlist saves and cart interest across all customers.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{c.label}</span>
              <c.icon className="h-5 w-5 text-primary" />
            </div>
            <div className="mt-3 text-2xl font-display font-bold">{isLoading ? "—" : c.value}</div>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="p-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <>
          <div className="mt-8 bg-card border border-border rounded-2xl p-6">
            <h2 className="font-display font-bold text-lg mb-4">Most saved products</h2>
            {(data?.topSaved ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No wishlist activity yet.</p>
            ) : (
              <div className="space-y-2">
                {data!.topSaved.map((p) => (
                  <div key={p.product_id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                    {p.product_image && <img loading="lazy" decoding="async" src={p.product_image} alt="" className="h-10 w-10 rounded object-cover" />}
                    <div className="flex-1 min-w-0 text-sm truncate">{p.product_name}</div>
                    <span className="text-sm font-semibold">{p.saves} save{p.saves === 1 ? "" : "s"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-8 grid lg:grid-cols-2 gap-6">
            <ActivityTable title="Wishlist activity" rows={data?.wishlist ?? []} />
            <ActivityTable title="Cart activity" rows={data?.cart ?? []} showQty />
          </div>
        </>
      )}
    </div>
  );
}

function ActivityTable({ title, rows, showQty }: { title: string; rows: any[]; showQty?: boolean }) {
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <h2 className="font-display font-bold text-lg p-5 pb-3">{title}</h2>
      {rows.length === 0 ? (
        <p className="px-5 pb-5 text-sm text-muted-foreground">Nothing yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-accent">
              <tr>
                <th className="text-left p-3">Customer</th>
                <th className="text-left p-3">Product</th>
                {showQty && <th className="text-right p-3">Qty</th>}
                <th className="text-right p-3">When</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 50).map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="p-3">
                    <div className="font-medium">{r.customer_name}</div>
                    <div className="text-xs text-muted-foreground">{r.customer_email}</div>
                  </td>
                  <td className="p-3">
                    <div className="truncate max-w-48">{r.product_name}</div>
                    <div className="text-xs text-muted-foreground">{formatNaira(r.product_price)}</div>
                  </td>
                  {showQty && <td className="p-3 text-right">{r.quantity}</td>}
                  <td className="p-3 text-right text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
