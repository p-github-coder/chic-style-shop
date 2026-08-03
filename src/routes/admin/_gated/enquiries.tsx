import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Mail, Check, Trash2, Loader2, Save } from "lucide-react";
import { listEnquiries, updateEnquiryStatus, deleteEnquiry, updateSiteSettings } from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/_gated/enquiries")({
  component: EnquiriesPage,
});

type Status = "unread" | "read" | "responded";
type Enquiry = {
  id: string; name: string; email: string; subject: string; message: string;
  status: Status; created_at: string;
};

const BADGE: Record<Status, string> = {
  unread: "bg-amber-100 text-amber-800",
  read: "bg-sky-100 text-sky-800",
  responded: "bg-emerald-100 text-emerald-800",
};

type Settings = {
  support_email: string; phone: string; address: string; hours: string;
  instagram_url: string; facebook_url: string; twitter_url: string; whatsapp_url: string;
};

const EMPTY: Settings = {
  support_email: "", phone: "", address: "", hours: "",
  instagram_url: "", facebook_url: "", twitter_url: "", whatsapp_url: "",
};

function EnquiriesPage() {
  const qc = useQueryClient();
  const fetchEnquiries = useServerFn(listEnquiries);
  const statusFn = useServerFn(updateEnquiryStatus);
  const deleteFn = useServerFn(deleteEnquiry);
  const saveSettingsFn = useServerFn(updateSiteSettings);
  const [filter, setFilter] = useState<"all" | Status>("all");
  const [form, setForm] = useState<Settings>(EMPTY);

  useRealtimeSync(["contact_messages"], [["admin", "enquiries"]]);

  const { data: enquiries = [], isLoading } = useQuery({
    queryKey: ["admin", "enquiries"],
    queryFn: () => fetchEnquiries({}) as Promise<Enquiry[]>,
    refetchOnWindowFocus: true,
  });

  const { data: settings } = useQuery({
    queryKey: ["site-settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("site_settings")
        .select("support_email, phone, address, hours, instagram_url, facebook_url, twitter_url, whatsapp_url")
        .maybeSingle();
      return (data ?? EMPTY) as Settings;
    },
  });

  useEffect(() => { if (settings) setForm(settings); }, [settings]);

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Status }) => statusFn({ data: { id, status } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "enquiries"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["admin", "enquiries"] });
      const prev = qc.getQueryData<Enquiry[]>(["admin", "enquiries"]);
      qc.setQueryData<Enquiry[]>(["admin", "enquiries"], (old) => (old ?? []).filter((m) => m.id !== id));
      return { prev };
    },
    onError: (e: Error, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(["admin", "enquiries"], ctx.prev);
      toast.error(e.message);
    },
    onSuccess: () => toast.success("Message deleted"),
  });

  const saveSettings = useMutation({
    mutationFn: () => saveSettingsFn({ data: form }),
    onSuccess: () => { toast.success("Contact details updated"); qc.invalidateQueries({ queryKey: ["site-settings"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const counts = (s: Status) => enquiries.filter((m) => m.status === s).length;
  const filtered = enquiries.filter((m) => filter === "all" || m.status === filter);

  const field = (key: keyof Settings, label: string, placeholder = "") => (
    <div>
      <label htmlFor={key} className="text-sm font-medium">{label}</label>
      <Input id={key} className="mt-1.5" value={form[key]} placeholder={placeholder}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
    </div>
  );

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-display font-extrabold">Enquiries</h1>
        <p className="text-muted-foreground mt-1">Messages from the Contact Us page, plus your public business details.</p>
      </div>

      <div className="mb-4 flex gap-2 flex-wrap">
        {(["all", "unread", "read", "responded"] as const).map((f) => (
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
          <div className="p-12 text-center text-muted-foreground">No messages in this view.</div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((m) => (
              <div key={m.id} className="p-4 sm:p-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{m.subject || "(no subject)"}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${BADGE[m.status]}`}>{m.status}</span>
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {m.name} · <a href={`mailto:${m.email}`} className="hover:text-primary underline-offset-2 hover:underline">{m.email}</a>
                    {" · "}{new Date(m.created_at).toLocaleString()}
                  </div>
                  <p className="mt-2 text-sm whitespace-pre-line">{m.message}</p>
                </div>
                <div className="flex gap-2 shrink-0 flex-wrap">
                  {m.status === "unread" && (
                    <Button size="sm" variant="outline" className="rounded-full" disabled={setStatus.isPending}
                      onClick={() => setStatus.mutate({ id: m.id, status: "read" })}>
                      <Check className="h-3.5 w-3.5 mr-1" /> Mark read
                    </Button>
                  )}
                  {m.status !== "responded" && (
                    <Button size="sm" className="rounded-full" disabled={setStatus.isPending}
                      onClick={() => setStatus.mutate({ id: m.id, status: "responded" })}>
                      <Mail className="h-3.5 w-3.5 mr-1" /> Responded
                    </Button>
                  )}
                  <Button size="sm" variant="destructive" className="rounded-full" disabled={remove.isPending}
                    onClick={() => { if (confirm("Delete this message permanently?")) remove.mutate(m.id); }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <section className="mt-10 bg-card border border-border rounded-2xl p-4 sm:p-6">
        <h2 className="text-xl font-display font-bold">Contact details</h2>
        <p className="text-sm text-muted-foreground mt-1">Shown publicly on the Contact Us page.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {field("support_email", "Support email", "support@pameluxury.com")}
          {field("phone", "Phone number", "+234 800 000 0000")}
          {field("address", "Business address", "Lagos, Nigeria")}
          {field("hours", "Operating hours", "Mon - Fri: 9am - 6pm")}
          {field("instagram_url", "Instagram URL", "https://instagram.com/…")}
          {field("facebook_url", "Facebook URL", "https://facebook.com/…")}
          {field("twitter_url", "X / Twitter URL", "https://x.com/…")}
          {field("whatsapp_url", "WhatsApp link", "https://wa.me/…")}
        </div>
        <Button className="mt-5 rounded-full" disabled={saveSettings.isPending} onClick={() => saveSettings.mutate()}>
          {saveSettings.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-2" /> Save details</>}
        </Button>
      </section>
    </div>
  );
}
