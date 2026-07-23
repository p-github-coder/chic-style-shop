import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Loader2, Ban, CheckCircle2, Trash2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { listUsers, setUserStatus, deleteUser } from "@/lib/admin.functions";
import { formatNaira } from "@/lib/format";

export const Route = createFileRoute("/admin/_gated/users")({
  component: UsersPage,
});

const STATUS: Record<string, string> = {
  approved: "bg-emerald-100 text-emerald-800",
  pending: "bg-amber-100 text-amber-800",
  rejected: "bg-rose-100 text-rose-800",
  suspended: "bg-slate-200 text-slate-800",
};

function UsersPage() {
  const list = useServerFn(listUsers);
  const setStatus = useServerFn(setUserStatus);
  const del = useServerFn(deleteUser);
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "suspended" | "rejected">("all");

  const { data = [], isLoading } = useQuery({ queryKey: ["admin", "users"], queryFn: () => list({}) });

  const status = useMutation({
    mutationFn: (v: { userId: string; status: "approved" | "suspended" | "rejected" | "pending" }) => setStatus({ data: v }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "users"] }); toast.success("Updated"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (userId: string) => del({ data: { userId } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "users"] }); toast.success("Deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = (data as any[]).filter((u) => {
    const matchesQ = (u.full_name + " " + u.email + " " + (u.username ?? "") + " " + (u.phone ?? ""))
      .toLowerCase().includes(q.toLowerCase());
    const matchesS = statusFilter === "all" || u.status === statusFilter;
    return matchesQ && matchesS;
  });

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-display font-extrabold">Customers</h1>
          <p className="text-muted-foreground mt-1">Approve, suspend, or remove customer accounts.</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search name, email, phone…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9 w-72" />
        </div>
      </div>

      <div className="mb-4 flex gap-2 flex-wrap">
        {(["all", "pending", "approved", "suspended", "rejected"] as const).map((f) => (
          <button key={f} onClick={() => setStatusFilter(f)}
            className={`px-4 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${
              statusFilter === f ? "bg-primary text-primary-foreground" : "bg-card border border-border hover:bg-accent"
            }`}>{f}</button>
        ))}
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
                  <th className="text-left p-3">Status</th>
                  <th className="text-right p-3">Orders</th>
                  <th className="text-right p-3">Spent</th>
                  <th className="text-right p-3">Actions</th>
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
                    <td className="p-3"><span className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full ${STATUS[u.status]}`}>{u.status}</span></td>
                    <td className="p-3 text-right">{u.orderCount}</td>
                    <td className="p-3 text-right">{formatNaira(u.orderTotal)}</td>
                    <td className="p-3">
                      <div className="flex justify-end gap-1 flex-wrap">
                        {u.status !== "approved" && (
                          <Button size="sm" variant="outline" onClick={() => status.mutate({ userId: u.id, status: "approved" })}>
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {u.status !== "suspended" && (
                          <Button size="sm" variant="outline" onClick={() => status.mutate({ userId: u.id, status: "suspended" })}>
                            <Ban className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button size="sm" variant="destructive" onClick={() => confirm(`Delete ${u.email}?`) && remove.mutate(u.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">No customers found.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
