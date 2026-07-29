import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { listOrders, updateOrderStatus, getOrderDetails } from "@/lib/admin.functions";
import { formatNaira } from "@/lib/format";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";


export const Route = createFileRoute("/admin/_gated/orders")({
  component: OrdersPage,
});

const STATUSES = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"] as const;
const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  confirmed: "bg-blue-100 text-blue-800",
  processing: "bg-indigo-100 text-indigo-800",
  shipped: "bg-purple-100 text-purple-800",
  delivered: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-rose-100 text-rose-800",
};

function OrdersPage() {
  const list = useServerFn(listOrders);
  const update = useServerFn(updateOrderStatus);
  const details = useServerFn(getOrderDetails);
  const qc = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);

  // New orders and status changes appear without a manual refresh.
  useRealtimeSync(["orders", "order_items"], [["admin", "orders"], ["admin", "metrics"]]);

  const { data = [], isLoading } = useQuery({ queryKey: ["admin", "orders"], queryFn: () => list({}) });

  const { data: detail } = useQuery({
    queryKey: ["admin", "order", openId],
    queryFn: () => details({ data: { orderId: openId! } }),
    enabled: !!openId,
  });

  const mut = useMutation({
    mutationFn: (v: { orderId: string; status: string }) => update({ data: v }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "orders"] }); qc.invalidateQueries({ queryKey: ["admin", "metrics"] }); toast.success("Status updated"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-display font-extrabold">Orders</h1>
        <p className="text-muted-foreground mt-1">View orders and update their fulfilment status.</p>
      </div>

      {isLoading ? (
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-accent">
                <tr>
                  <th className="text-left p-3">Order</th>
                  <th className="text-left p-3">Customer</th>
                  <th className="text-right p-3">Total</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-left p-3">Placed</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {data.map((o: any) => (
                  <tr key={o.id} className="border-t border-border">
                    <td className="p-3 font-mono text-xs">{o.order_number}</td>
                    <td className="p-3">
                      <div className="font-medium">{o.customer_name}</div>
                      <div className="text-xs text-muted-foreground">{o.customer_email}</div>
                    </td>
                    <td className="p-3 text-right font-semibold">{formatNaira(Number(o.total))}</td>
                    <td className="p-3">
                      <select
                        value={o.status}
                        onChange={(e) => mut.mutate({ orderId: o.id, status: e.target.value })}
                        className={`text-xs font-semibold uppercase px-2 py-1 rounded-full border-0 outline-none cursor-pointer ${STATUS_STYLES[o.status]}`}
                      >
                        {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString()}</td>
                    <td className="p-3 text-right">
                      <Button size="sm" variant="outline" onClick={() => setOpenId(o.id)}>View</Button>
                    </td>
                  </tr>
                ))}
                {data.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No orders yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {openId && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setOpenId(null)}>
          <div className="bg-card rounded-3xl max-w-2xl w-full max-h-[85vh] overflow-auto p-6 relative" onClick={(e) => e.stopPropagation()}>
            <button className="absolute top-4 right-4" onClick={() => setOpenId(null)}><X className="h-5 w-5" /></button>
            {!detail || !detail.order ? <Loader2 className="h-5 w-5 animate-spin" /> : (
              <>
                <h2 className="font-display font-bold text-2xl">{detail.order.order_number}</h2>
                <p className="text-sm text-muted-foreground mt-1">{new Date(detail.order.created_at).toLocaleString()}</p>
                <div className="mt-4 grid sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground text-xs uppercase">Customer</div>
                    <div className="font-medium">{detail.order.customer_name}</div>
                    <div>{detail.order.customer_email}</div>
                    {detail.order.phone && <div>{detail.order.phone}</div>}
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs uppercase">Shipping</div>
                    <div className="whitespace-pre-line">{detail.order.shipping_address}</div>
                  </div>
                </div>
                <div className="mt-6">
                  <div className="text-muted-foreground text-xs uppercase mb-2">Items</div>
                  <div className="space-y-2">
                    {detail.items.map((it: any) => (
                      <div key={it.id} className="flex items-center gap-3">
                        <img src={it.product_image} alt="" className="h-12 w-12 rounded object-cover" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{it.product_name}</div>
                          <div className="text-xs text-muted-foreground">Qty {it.quantity} × {formatNaira(Number(it.price))}</div>
                        </div>
                        <div className="text-sm font-semibold">{formatNaira(Number(it.price) * it.quantity)}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-6 border-t border-border pt-4 space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatNaira(Number(detail.order.subtotal))}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Delivery</span><span>{formatNaira(Number(detail.order.delivery_fee))}</span></div>
                  <div className="flex justify-between font-bold text-base"><span>Total</span><span>{formatNaira(Number(detail.order.total))}</span></div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
