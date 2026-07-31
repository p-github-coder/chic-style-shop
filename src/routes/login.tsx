import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { BrandLogo } from "@/components/Brand";
import authHair from "@/assets/auth-hair.jpg";


export const Route = createFileRoute("/login")({
  ssr: false,
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { data: signIn, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      if (/confirm/i.test(error.message)) {
        toast.error("Your account is still awaiting admin approval. You'll be able to sign in once it's approved.");
      } else {
        toast.error(error.message);
      }
      return;
    }

    // Always re-read the *latest* account status straight from the database
    // (never a cached value) before letting anyone through.
    const [{ data: profile }, { data: application }] = await Promise.all([
      supabase.from("profiles").select("status").eq("id", signIn.user.id).maybeSingle(),
      supabase
        .from("registration_applications")
        .select("status, rejection_reason")
        .eq("user_id", signIn.user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    // The stricter of the two records wins, so a suspension can never be bypassed.
    const status =
      profile?.status === "approved" && application?.status && application.status !== "approved"
        ? application.status
        : profile?.status ?? application?.status ?? "pending";

    const MESSAGES: Record<string, string> = {
      pending:
        "Your account is awaiting administrator approval. You'll be able to sign in once it is approved.",
      rejected:
        "Your account application was rejected by the administrator. Please contact support for more information.",
      suspended:
        "Your account has been suspended by the administrator. Please contact support for assistance.",
    };

    if (status !== "approved") {
      await supabase.auth.signOut({ scope: "local" });
      setLoading(false);
      toast.error(
        MESSAGES[status] ??
          "Your account is not active. Please contact support for assistance.",
      );
      return;
    }

    setLoading(false);
    toast.success("Welcome back!");
    navigate({ to: "/" });
  }


  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between p-12 text-white relative overflow-hidden">
        <img
          src={authHair}
          alt="Luxury pearl hair accessories on silk"
          width={1024}
          height={1536}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/45 to-black/25" />
        <Link to="/" className="relative z-10 flex items-center gap-2 font-display font-bold text-2xl">
          <BrandLogo className="h-9 w-9" /> PameLuxury
        </Link>
        <div className="relative z-10">
          <h1 className="text-5xl font-display font-extrabold leading-tight">
            Welcome back,<br />bonne journée.
          </h1>
          <p className="mt-4 text-lg opacity-90 max-w-md">
            Curated bags, jewelry and beauty from the houses she loves.
          </p>
        </div>
        <p className="relative z-10 text-sm opacity-80">© {new Date().getFullYear()} PameLuxury</p>
      </div>



      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <Link to="/" className="lg:hidden flex items-center gap-2 font-display font-bold text-xl text-primary mb-8">
            <BrandLogo className="h-8 w-8" /> PameLuxury
          </Link>
          <h2 className="text-3xl font-display font-bold">Welcome back</h2>
          <p className="mt-2 text-muted-foreground">Sign in to continue shopping.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input id="password" type={showPw ? "text" : "password"} required
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" />
                <button type="button" onClick={() => setShowPw((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPw ? "Hide password" : "Show password"}>
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="remember" checked={remember} onCheckedChange={(v) => setRemember(!!v)} />
              <Label htmlFor="remember" className="text-sm font-normal cursor-pointer">Remember me</Label>
            </div>
            <Button type="submit" disabled={loading} className="w-full h-11 rounded-full text-base">
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <p className="mt-6 text-sm text-muted-foreground text-center">
            Don't have an account?{" "}
            <Link to="/signup" className="text-primary font-medium hover:underline">
              Sign up
            </Link>
          </p>
          <p className="mt-2 text-sm text-muted-foreground text-center">
            <Link to="/" className="hover:underline">← Back to home</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
