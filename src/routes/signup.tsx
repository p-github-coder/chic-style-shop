import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff, ShoppingBag, Store, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/signup")({
  ssr: false,
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [role, setRole] = useState<"customer" | "seller">("customer");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) return toast.error("Passwords don't match");
    if (password.length < 6) return toast.error("Password must be at least 6 characters");

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { full_name: fullName, requested_role: role },
      },
    });

    if (error) {
      setLoading(false);
      toast.error(error.message);
      return;
    }

    // Sign out immediately — user must wait for admin approval
    await supabase.auth.signOut();
    setLoading(false);
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <div className="max-w-md w-full text-center bg-card border border-border rounded-3xl p-10">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-accent text-primary mb-4">
            <ShoppingBag className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-display font-bold">Application submitted</h1>
          <p className="mt-3 text-muted-foreground">
            Your {role} application is pending admin review. You'll be able to sign in once it's approved.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <Button asChild className="rounded-full"><Link to="/">Browse marketplace</Link></Button>
            <Button asChild variant="outline" className="rounded-full"><Link to="/login">Sign in</Link></Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between p-12 text-primary-foreground relative overflow-hidden"
        style={{ background: "var(--gradient-primary)" }}>
        <Link to="/" className="flex items-center gap-2 font-display font-bold text-2xl">
          <ShoppingBag className="h-7 w-7" /> Solestep
        </Link>
        <div>
          <h1 className="text-5xl font-display font-extrabold leading-tight">
            Join the<br />Solestep community.
          </h1>
          <p className="mt-4 text-lg opacity-90 max-w-md">
            Shop curated drops or open your own shop — all in one marketplace.
          </p>
        </div>
        <p className="text-sm opacity-80">© {new Date().getFullYear()} Solestep</p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <Link to="/" className="lg:hidden flex items-center gap-2 font-display font-bold text-xl text-primary mb-8">
            <ShoppingBag className="h-6 w-6" /> Solestep
          </Link>
          <h2 className="text-3xl font-display font-bold">Create your account</h2>
          <p className="mt-2 text-muted-foreground">Applications are reviewed by our team.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div className="space-y-2">
              <Label>Register as</Label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { id: "customer", label: "Customer", icon: User },
                  { id: "seller", label: "Seller", icon: Store },
                ] as const).map((opt) => (
                  <button key={opt.id} type="button" onClick={() => setRole(opt.id)}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${
                      role === opt.id ? "border-primary bg-accent" : "border-border hover:bg-accent/50"
                    }`}>
                    <opt.icon className="h-5 w-5 text-primary mb-1" />
                    <div className="font-medium text-sm">{opt.label}</div>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" required value={fullName}
                onChange={(e) => setFullName(e.target.value)} placeholder="Jane Doe" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
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
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input id="confirm" type={showPw ? "text" : "password"} required
                value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
            <Button type="submit" disabled={loading} className="w-full h-11 rounded-full text-base">
              {loading ? "Submitting…" : "Submit application"}
            </Button>
          </form>

          <p className="mt-6 text-sm text-muted-foreground text-center">
            Already have an account?{" "}
            <Link to="/login" className="text-primary font-medium hover:underline">Sign in</Link>
          </p>
          <p className="mt-2 text-sm text-muted-foreground text-center">
            <Link to="/" className="hover:underline">← Back to home</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
