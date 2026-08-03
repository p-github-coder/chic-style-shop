import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { Mail, Phone, MapPin, Clock, Instagram, Facebook, Twitter, MessageCircle, Loader2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/contact")({
  component: ContactPage,
  head: () => ({
    meta: [
      { title: "Contact PameLuxury | Customer Support & Enquiries" },
      { name: "description", content: "Get in touch with PameLuxury. Send us a message, or reach our support team by email, phone or social media." },
      { property: "og:title", content: "Contact PameLuxury" },
      { property: "og:description", content: "Questions about an order, a product or a delivery? Our team is here to help." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const schema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(100),
  email: z.string().trim().email("Enter a valid email address").max(255),
  subject: z.string().trim().min(2, "Please add a subject").max(150),
  message: z.string().trim().min(10, "Tell us a little more (min 10 characters)").max(2000),
});

export function useSiteSettings() {
  return useQuery({
    queryKey: ["site-settings"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("site_settings")
        .select("support_email, phone, address, hours, instagram_url, facebook_url, twitter_url, whatsapp_url")
        .maybeSingle();
      return data;
    },
  });
}

function ContactPage() {
  const { data: settings } = useSiteSettings();
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });

  const send = useMutation({
    mutationFn: async () => {
      const parsed = schema.parse(form);
      const { error } = await supabase.from("contact_messages").insert(parsed);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Message sent — our team will get back to you shortly");
      setForm({ name: "", email: "", subject: "", message: "" });
    },
    onError: (e: unknown) => {
      const msg = e instanceof z.ZodError ? e.issues[0]?.message ?? "Please check the form" : (e as Error).message;
      toast.error(msg);
    },
  });

  const socials = [
    { url: settings?.instagram_url, icon: Instagram, label: "Instagram" },
    { url: settings?.facebook_url, icon: Facebook, label: "Facebook" },
    { url: settings?.twitter_url, icon: Twitter, label: "X / Twitter" },
    { url: settings?.whatsapp_url, icon: MessageCircle, label: "WhatsApp" },
  ].filter((s) => !!s.url);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-20 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <header className="text-center max-w-2xl mx-auto">
            <div className="text-xs font-medium tracking-[0.25em] uppercase text-primary">Contact us</div>
            <h1 className="mt-2 text-3xl sm:text-5xl font-display font-extrabold">We're here to help</h1>
            <p className="mt-3 text-muted-foreground">
              Questions about an order, a product or a delivery? Send us a message and our team will respond within one business day.
            </p>
          </header>

          <div className="mt-12 grid gap-8 lg:grid-cols-[1.3fr_1fr]">
            <form
              onSubmit={(e) => { e.preventDefault(); send.mutate(); }}
              className="bg-card border border-border rounded-3xl p-6 sm:p-8 space-y-4"
            >
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="c-name" className="text-sm font-medium">Name</label>
                  <Input id="c-name" className="mt-1.5" value={form.name} maxLength={100}
                    onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your full name" required />
                </div>
                <div>
                  <label htmlFor="c-email" className="text-sm font-medium">Email address</label>
                  <Input id="c-email" type="email" className="mt-1.5" value={form.email} maxLength={255}
                    onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" required />
                </div>
              </div>
              <div>
                <label htmlFor="c-subject" className="text-sm font-medium">Subject</label>
                <Input id="c-subject" className="mt-1.5" value={form.subject} maxLength={150}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="How can we help?" required />
              </div>
              <div>
                <label htmlFor="c-message" className="text-sm font-medium">Message</label>
                <Textarea id="c-message" rows={6} className="mt-1.5" value={form.message} maxLength={2000}
                  onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Write your message…" required />
              </div>
              <Button type="submit" disabled={send.isPending} className="w-full sm:w-auto h-12 px-8 rounded-full">
                {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4 mr-2" /> Send message</>}
              </Button>
            </form>

            <aside className="space-y-4">
              <div className="bg-card border border-border rounded-3xl p-6 space-y-4">
                <div className="font-display font-bold text-lg">Customer support</div>
                <a href={`mailto:${settings?.support_email ?? ""}`} className="flex items-start gap-3 text-sm hover:text-primary">
                  <Mail className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                  <span>{settings?.support_email ?? "—"}</span>
                </a>
                <a href={`tel:${(settings?.phone ?? "").replace(/\s/g, "")}`} className="flex items-start gap-3 text-sm hover:text-primary">
                  <Phone className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                  <span>{settings?.phone ?? "—"}</span>
                </a>
                <div className="flex items-start gap-3 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                  <span>{settings?.address ?? "—"}</span>
                </div>
                <div className="flex items-start gap-3 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                  <span>{settings?.hours ?? "—"}</span>
                </div>
              </div>

              {socials.length > 0 && (
                <div className="bg-card border border-border rounded-3xl p-6">
                  <div className="font-display font-bold text-lg mb-3">Follow us</div>
                  <div className="flex flex-wrap gap-2">
                    {socials.map((s) => (
                      <a key={s.label} href={s.url!} target="_blank" rel="noreferrer noopener"
                        aria-label={s.label}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border hover:bg-accent transition-colors">
                        <s.icon className="h-5 w-5" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-accent/40 border border-border rounded-3xl p-6 text-sm text-muted-foreground">
                Estimated delivery: your order arrives within 7 days after successful payment.
              </div>
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}
