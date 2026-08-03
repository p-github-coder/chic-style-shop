import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Check, X, Loader2, Clock, CheckCircle2, XCircle, Trash2, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import {
  listApplications,
  approveApplication,
  rejectApplication,
  suspendApplication,
  deleteApplication,
} from "@/lib/admin.functions";


export const Route = createFileRoute("/admin/_gated/applications")({
  component: ApplicationsPage,
});

type Status = "pending" | "approved" | "rejected" | "suspended";

type Application = {
  id: string;
  full_name: string;
  email: string;
  username: string | null;
  phone: string | null;
  age: number | null;
  state: string | null;
  city: string | null;
  requested_role: "admin" | "customer" | "seller";
  status: Status;
  rejection_reason: string | null;
  created_at: string;
};

const BADGES: Record<Status, { icon: typeof Clock; cls: string; label: string }> = {
  pending: { icon: Clock, cls: "bg-amber-100 text-amber-800", label: "Pending" },
  approved: { icon: CheckCircle2, cls: "bg-emerald-100 text-emerald-800", label: "Approved" },
  rejected: { icon: XCircle, cls: "bg-red-100 text-red-800", label: "Rejected" },
  suspended: { icon: Ban, cls: "bg-slate-200 text-slate-800", label: "Suspended" },
};

function ApplicationsPage() {
  const qc = useQueryClient();
  const fetchApps = useServerFn(listApplications);
  const approveFn = useServerFn(approveApplication);
  const rejectFn = useServerFn(rejectApplication);
  const suspendFn = useServerFn(suspendApplication);
  const deleteFn = useServerFn(deleteApplication);
  const [filter, setFilter] = useState<"all" | Status>("pending");

  // Signups land instantly — no manual refresh needed.
  useRealtimeSync(["registration_applications", "profiles"], [["admin", "applications"], ["admin", "metrics"], ["admin", "users"]]);

  const { data: applications = [], isLoading } = useQuery({
    queryKey: ["admin", "applications"],
    queryFn: () => fetchApps({}) as Promise<Application[]>,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });


  const refresh = () => qc.invalidateQueries({ queryKey: ["admin"] });

  const approve = useMutation({
    mutationFn: (id: string) => approveFn({ data: { applicationId: id } }),
    onSuccess: () => { toast.success("Approved — the customer can now sign in"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectFn({ data: { applicationId: id, reason } }),
    onSuccess: () => { toast.success("Application rejected"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const suspend = useMutation({
    mutationFn: (id: string) => suspendFn({ data: { applicationId: id } }),
    onSuccess: () => { toast.success("Account suspended"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { applicationId: id } }),
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: ["admin", "applications"] });
      const prev = qc.getQueryData<Application[]>(["admin", "applications"]);
      qc.setQueryData<Application[]>(["admin", "applications"], (old) => (old ?? []).filter((a) => a.id !== id));
      return { prev };
    },
    onError: (e: Error, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(["admin", "applications"], ctx.prev);
      toast.error(e.message);
    },
    onSuccess: () => { toast.success("Application deleted"); refresh(); },
  });

  const [pendingDelete, setPendingDelete] = useState<Application | null>(null);

  const counts = (s: Status) => applications.filter((a) => a.status === s).length;
  const filtered = applications.filter((a) => filter === "all" || a.status === filter);

  const badge = (status: Status) => {
    const map = BADGES[status] ?? BADGES.pending;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${map.cls}`}>
        <map.icon className="h-3 w-3" /> {map.label}
      </span>
    );
  };

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-display font-extrabold">Registration applications</h1>
        <p className="text-muted-foreground mt-1">
          Approve, reject, suspend or delete customer accounts. Approved customers appear under Customers.
        </p>
      </div>

      <div className="mb-4 flex gap-2 flex-wrap">
        {(["pending", "approved", "rejected", "suspended", "all"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-full text-sm font-medium capitalize transition-colors ${
              filter === f ? "bg-primary text-primary-foreground" : "bg-card border border-border hover:bg-accent"
            }`}>
            {f}
            {f !== "all" && <span className="ml-1.5 opacity-70">{counts(f)}</span>}
          </button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">No applications in this view.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Phone</th>
                  <th className="px-4 py-3 font-medium">Age</th>
                  <th className="px-4 py-3 font-medium">Location</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((app) => (
                  <tr key={app.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <div className="font-medium">{app.full_name || "—"}</div>
                      {app.username && <div className="text-xs text-muted-foreground">@{app.username}</div>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{app.email}</td>
                    <td className="px-4 py-3 text-xs">{app.phone || "—"}</td>
                    <td className="px-4 py-3 text-xs">{app.age ?? "—"}</td>
                    <td className="px-4 py-3 text-xs">{[app.city, app.state].filter(Boolean).join(", ") || "—"}</td>
                    <td className="px-4 py-3">{badge(app.status)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{new Date(app.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 justify-end flex-wrap">
                        {app.status !== "approved" && (
                          <Button size="sm" onClick={() => approve.mutate(app.id)}
                            disabled={approve.isPending} className="rounded-full">
                            <Check className="h-3.5 w-3.5 mr-1" /> Approve
                          </Button>
                        )}
                        {app.status !== "rejected" && (
                          <Button size="sm" variant="outline"
                            onClick={() => {
                              const reason = window.prompt("Rejection reason (optional):") ?? "";
                              reject.mutate({ id: app.id, reason });
                            }}
                            disabled={reject.isPending} className="rounded-full">
                            <X className="h-3.5 w-3.5 mr-1" /> Reject
                          </Button>
                        )}
                        {app.status !== "suspended" && (
                          <Button size="sm" variant="outline" className="rounded-full"
                            disabled={suspend.isPending}
                            onClick={() => { if (confirm(`Suspend ${app.email}?`)) suspend.mutate(app.id); }}>
                            <Ban className="h-3.5 w-3.5 mr-1" /> Suspend
                          </Button>
                        )}
                        <Button size="sm" variant="destructive" className="rounded-full"
                          disabled={remove.isPending}
                          onClick={() => setPendingDelete(app)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this application?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the registration application for {pendingDelete?.email} from the system. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (pendingDelete) remove.mutate(pendingDelete.id); setPendingDelete(null); }}
            >
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
