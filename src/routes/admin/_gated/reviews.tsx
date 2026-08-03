import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Star, Check, X, Trash2, Loader2 } from "lucide-react";
import { listReviews, moderateReview, deleteReview } from "@/lib/admin.functions";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/_gated/reviews")({
  component: ReviewsPage,
});

type Status = "pending" | "approved" | "rejected";

type Review = {
  id: string;
  rating: number;
  title: string;
  body: string;
  author_name: string;
  status: Status;
  created_at: string;
  products: { name: string; slug: string | null } | null;
};

const BADGE: Record<Status, string> = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
};

function ReviewsPage() {
  const qc = useQueryClient();
  const fetchReviews = useServerFn(listReviews);
  const moderateFn = useServerFn(moderateReview);
  const deleteFn = useServerFn(deleteReview);
  const [filter, setFilter] = useState<"all" | Status>("pending");

  useRealtimeSync(["reviews"], [["admin", "reviews"]]);

  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ["admin", "reviews"],
    queryFn: () => fetchReviews({}) as Promise<Review[]>,
    refetchOnWindowFocus: true,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin"] });

  const moderate = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Status }) => moderateFn({ data: { reviewId: id, status } }),
    onSuccess: (_d, v) => { toast.success(v.status === "approved" ? "Review published" : "Review rejected"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { reviewId: id } }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["admin", "reviews"] });
      const prev = qc.getQueryData<Review[]>(["admin", "reviews"]);
      qc.setQueryData<Review[]>(["admin", "reviews"], (old) => (old ?? []).filter((r) => r.id !== id));
      return { prev };
    },
    onError: (e: Error, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(["admin", "reviews"], ctx.prev);
      toast.error(e.message);
    },
    onSuccess: () => { toast.success("Review deleted"); refresh(); },
  });

  const counts = (s: Status) => reviews.filter((r) => r.status === s).length;
  const filtered = reviews.filter((r) => filter === "all" || r.status === filter);

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-display font-extrabold">Reviews</h1>
        <p className="text-muted-foreground mt-1">
          Reviews stay hidden until you approve them. Only approved reviews appear on product pages.
        </p>
      </div>

      <div className="mb-4 flex gap-2 flex-wrap">
        {(["pending", "approved", "rejected", "all"] as const).map((f) => (
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
          <div className="p-12 text-center text-muted-foreground">No reviews in this view.</div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((r) => (
              <div key={r.id} className="p-4 sm:p-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{r.products?.name ?? "Product removed"}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${BADGE[r.status]}`}>{r.status}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">{r.author_name || "Customer"}</span>
                    <span className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star key={n} className={`h-3.5 w-3.5 ${n <= r.rating ? "fill-primary text-primary" : "text-muted-foreground"}`} />
                      ))}
                    </span>
                    <span>· {new Date(r.created_at).toLocaleDateString()}</span>
                  </div>
                  {r.title && <div className="mt-2 font-medium">{r.title}</div>}
                  <p className="mt-1 text-sm text-muted-foreground whitespace-pre-line">{r.body}</p>
                </div>
                <div className="flex gap-2 shrink-0 flex-wrap">
                  {r.status !== "approved" && (
                    <Button size="sm" className="rounded-full" disabled={moderate.isPending}
                      onClick={() => moderate.mutate({ id: r.id, status: "approved" })}>
                      <Check className="h-3.5 w-3.5 mr-1" /> Approve
                    </Button>
                  )}
                  {r.status !== "rejected" && (
                    <Button size="sm" variant="outline" className="rounded-full" disabled={moderate.isPending}
                      onClick={() => moderate.mutate({ id: r.id, status: "rejected" })}>
                      <X className="h-3.5 w-3.5 mr-1" /> Reject
                    </Button>
                  )}
                  <Button size="sm" variant="destructive" className="rounded-full" disabled={remove.isPending}
                    onClick={() => { if (confirm("Permanently delete this review?")) remove.mutate(r.id); }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
