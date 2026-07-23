import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabaseAdminClient as supabase } from "@/integrations/supabase/admin-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { bootstrapAdmin } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/login")({
  ssr: false,
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const navigate = useNavigate();
  const boot = useServerFn(bootstrapAdmin);
  const [email, setEmail] = useState("uzlivinus@gmail.com");
  const [password, setPassword] = useState("uzlivinus565");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Idempotent: create OR force-reset admin account so credentials always match
    boot({}).catch(() => {}).finally(() => setReady(true));
  }, [boot]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    // Ensure bootstrap has run at least once before trying
    if (!ready) {
      try { await boot({}); } catch { /* ignore */ }
    }
    let userId: string | undefined;
    const first = await supabase.auth.signInWithPassword({ email, password });
    if (first.error) {
      try { await boot({}); } catch { /* ignore */ }
      const retry = await supabase.auth.signInWithPassword({ email, password });
      if (retry.error) {
        setLoading(false);
        toast.error(retry.error.message);
        return;
      }
      userId = retry.data.user?.id;
    } else {
      userId = first.data.user?.id;
    }
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId!,
      _role: "admin",
    });
    if (!isAdmin) {
      await supabase.auth.signOut();
      setLoading(false);
      toast.error("This account is not an administrator.");
      return;
    }
    setLoading(false);
    toast.success("Welcome, admin");
    navigate({ to: "/admin/dashboard" });
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground mb-4">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-display font-bold">Admin sign in</h1>
          <p className="text-muted-foreground mt-1">Restricted area — administrators only.</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-3xl p-8 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email}
              onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input id="password" type={showPw ? "text" : "password"} required
                value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" onClick={() => setShowPw((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showPw ? "Hide password" : "Show password"}>
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <Button type="submit" disabled={loading} className="w-full h-11 rounded-full text-base">
            {loading ? "Signing in…" : "Sign in as admin"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link to="/" className="hover:underline">← Back to home</Link>
        </p>
      </div>
    </div>
  );
}
