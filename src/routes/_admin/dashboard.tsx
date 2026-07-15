import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Users, Store, Clock, CheckCircle2, XCircle, Package, ArrowRight } from "lucide-react";
import { getAdminMetrics } from "@/lib/admin.functions";

export const Route = createFileRoute("/_admin/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const fetchMetrics = useServerFn(getAdminMetrics);
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "metrics"],
    queryFn: () => fetchMetrics({}),
  });

  const cards = [
    { label: "Total Users", value: data?.totalUsers ?? 0, icon: Users, color: "text-primary" },
    { label: "Total Sellers", value: data?.totalSellers ?? 0, icon: Store, color: "text-primary" },
    { label: "Pending Applications", value: data?.pending ?? 0, icon: Clock, color: "text-amber-600" },
    { label: "Approved", value: data?.approved ?? 0, icon: CheckCircle2, color: "text-emerald-600" },
    { label: "Rejected", value: data?.rejected ?? 0, icon: XCircle, color: "text-destructive" },
    { label: "Total Products", value: data?.totalProducts ?? 0, icon: Package, color: "text-primary" },
    { label: "Active Listings", value: data?.totalProducts ?? 0, icon: Package, color: "text-primary" },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-display font-extrabold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Marketplace overview and management shortcuts.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{c.label}</span>
              <c.icon className={`h-5 w-5 ${c.color}`} />
            </div>
            <div className="mt-3 text-3xl font-display font-bold">
              {isLoading ? "—" : c.value}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 bg-card border border-border rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display font-bold text-lg">Pending applications</h2>
            <p className="text-sm text-muted-foreground">Review and approve new registrations.</p>
          </div>
          <Link to="/admin/applications"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            Manage <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
