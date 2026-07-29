import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Loader2, Search, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { listUsers } from "@/lib/admin.functions";
import { formatNaira } from "@/lib/format";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";

export const Route = createFileRoute("/admin/_gated/users")({
  component: UsersPage,
});

const STATUS_CLS: Record<string, string> = {
  approved: "bg-emerald-100 text-emerald-800",
  pending: "bg-amber-100 text-amber-800",
  rejected: "bg-red-100 text-red-800",
  suspended: "bg-slate-200 text-slate-800",
};

function UsersPage() {
  const list = useServerFn(listUsers);
  const [q, setQ] = useState("");

  // Live refresh whenever any customer-facing table changes.
  useRealtimeSync(
    ["profiles", "registration_applications", "orders", "wishlist_items", "cart_items"],
    [["admin", "users"]],
  );

  const { data = [], isLoading } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => list({}),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  const filtered = (data as any[]).filter((u) =>
    (u.full_name + " " + u.email + " " + (u.username ?? "") + " " + (u.phone ?? ""))
      .toLowerCase()
      .includes(q.toLowerCase()),
  );


  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-display font-extrabold">Customers</h1>
          <p className="text-muted-foreground mt-1">
            Approved customer accounts and their activity. Approvals are managed in{" "}
            <Link to="/admin/applications" className="text-primary hover:underline inline-flex items-center gap-1">
              Applications <ArrowRight className="h-3 w-3" />
            </Link>
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search name, email, phone…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9 w-72" />
        </div>
      </div>

      {isLoading ? (
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-accent">
                <tr>
                  <th className="text-left p-3">Customer</th>
                  <th className="text-left p-3">Username</th>
                  <th className="text-left p-3">Phone</th>
                  <th className="text-left p-3">Age</th>
                  <th className="text-left p-3">Location</th>
                  <th className="text-left p-3">Joined</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-right p-3">Wishlist</th>
                  <th className="text-right p-3">Cart</th>
                  <th className="text-right p-3">Orders</th>
                  <th className="text-left p-3">Last order</th>
                  <th className="text-right p-3">Spent</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u: any) => (
                  <tr key={u.id} className="border-t border-border">
                    <td className="p-3">
                      <div className="font-medium">{u.full_name || "—"}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </td>
                    <td className="p-3 text-xs">{u.username || "—"}</td>
                    <td className="p-3 text-xs">{u.phone || "—"}</td>
                    <td className="p-3 text-xs">{u.age ?? "—"}</td>
                    <td className="p-3 text-xs">{[u.city, u.state].filter(Boolean).join(", ") || "—"}</td>
                    <td className="p-3 text-xs">{new Date(u.created_at).toLocaleDateString()}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_CLS[u.status] ?? ""}`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="p-3 text-right">{u.wishlistCount}</td>
                    <td className="p-3 text-right">{u.cartCount}</td>
                    <td className="p-3 text-right">{u.orderCount}</td>
                    <td className="p-3 text-xs">{u.lastOrderAt ? new Date(u.lastOrderAt).toLocaleDateString() : "—"}</td>
                    <td className="p-3 text-right">{formatNaira(u.orderTotal)}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={12} className="p-8 text-center text-muted-foreground">No approved customers yet.</td></tr>
                )}

              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
