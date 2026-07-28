import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Users, ShoppingCart, Clock, Package, AlertTriangle, DollarSign, TrendingUp, ArrowRight } from "lucide-react";
import { getAdminMetrics } from "@/lib/admin.functions";
import { formatNaira } from "@/lib/format";

export const Route = createFileRoute("/admin/_gated/dashboard")({
  component: DashboardPage,
});

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  confirmed: "bg-blue-100 text-blue-800",
  processing: "bg-indigo-100 text-indigo-800",
  shipped: "bg-purple-100 text-purple-800",
  delivered: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-rose-100 text-rose-800",
};

function DashboardPage() {
  const fetchMetrics = useServerFn(getAdminMetrics);
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "metrics"],
    queryFn: () => fetchMetrics({}),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
  });

  const cards = [
    { label: "Revenue", value: formatNaira(data?.revenue ?? 0), icon: DollarSign, color: "text-emerald-600" },
    { label: "Total Orders", value: data?.totalOrders ?? 0, icon: ShoppingCart, color: "text-primary" },
    { label: "Total Customers", value: data?.approvedCustomers ?? 0, icon: Users, color: "text-primary" },
    { label: "Pending Registrations", value: data?.pending ?? 0, icon: Clock, color: "text-amber-600" },
    { label: "Approved Registrations", value: data?.approved ?? 0, icon: Users, color: "text-emerald-600" },
    { label: "Rejected Registrations", value: data?.rejected ?? 0, icon: Clock, color: "text-rose-600" },
    { label: "Total Products", value: data?.totalProducts ?? 0, icon: Package, color: "text-primary" },
    { label: "In Stock", value: data?.inStock ?? 0, icon: Package, color: "text-emerald-600" },
    { label: "Low Stock", value: data?.lowStock ?? 0, icon: TrendingUp, color: "text-amber-600" },
    { label: "Out of Stock", value: data?.outOfStock ?? 0, icon: AlertTriangle, color: "text-destructive" },
    { label: "Suspended", value: data?.suspendedCustomers ?? 0, icon: Users, color: "text-slate-600" },
    { label: "Delivered", value: data?.byStatus?.delivered ?? 0, icon: ShoppingCart, color: "text-emerald-600" },
  ];


  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-display font-extrabold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Marketplace overview at a glance.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{c.label}</span>
              <c.icon className={`h-5 w-5 ${c.color}`} />
            </div>
            <div className="mt-3 text-2xl md:text-3xl font-display font-bold">
              {isLoading ? "—" : c.value}
            </div>
          </div>
        ))}
      </div>

      {/* Order status breakdown */}
      <div className="mt-8 bg-card border border-border rounded-2xl p-6">
        <h2 className="font-display font-bold text-lg mb-4">Orders by status</h2>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"].map((s) => (
            <div key={s} className="text-center p-3 rounded-xl bg-accent">
              <div className={`inline-block text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full font-semibold ${STATUS_COLORS[s]}`}>{s}</div>
              <div className="mt-1 text-xl font-bold">{data?.byStatus?.[s] ?? 0}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 grid lg:grid-cols-2 gap-6">
        {/* Recent orders */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold text-lg">Recent orders</h2>
            <Link to="/admin/orders" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="space-y-2">
            {(data?.recentOrders ?? []).length === 0 && <p className="text-sm text-muted-foreground">No orders yet.</p>}
            {(data?.recentOrders ?? []).map((o: any) => (
              <div key={o.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{o.order_number}</div>
                  <div className="text-xs text-muted-foreground truncate">{o.customer_name}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-semibold">{formatNaira(Number(o.total))}</div>
                  <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded-full font-semibold ${STATUS_COLORS[o.status]}`}>{o.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Low stock */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold text-lg">Low stock alerts</h2>
            <Link to="/admin/products" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
              Manage <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="space-y-2">
            {(data?.lowStockItems ?? []).length === 0 && <p className="text-sm text-muted-foreground">All products well stocked.</p>}
            {(data?.lowStockItems ?? []).map((p: any) => (
              <div key={p.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                <img src={p.image_url} alt="" className="h-10 w-10 rounded object-cover" />
                <div className="flex-1 min-w-0 text-sm truncate">{p.name}</div>
                <span className={`text-xs font-semibold ${p.stock === 0 ? "text-destructive" : "text-amber-600"}`}>
                  {p.stock === 0 ? "Out of stock" : `${p.stock} left`}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
