import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff, ShoppingBag } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/signup")({
  ssr: false,
  component: SignupPage,
});

const schema = z
  .object({
    fullName: z.string().trim().min(2, "Please enter your full name").max(100),
    email: z.string().trim().email("Enter a valid email").max(255),
    password: z.string().min(8, "Password must be at least 8 characters").max(72),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Passwords don't match",
    path: ["confirm"],
  });

function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ fullName, email, password, confirm });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => (errs[i.path[0] as string] = i.message));
      setErrors(errs);
      return;
    }
    setErrors({});
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { full_name: fullName, requested_role: "customer" },
      },
    });

    if (error) {
      setLoading(false);
      toast.error(error.message);
      return;
    }

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
            Your account is pending admin review. You'll be able to sign in once it's approved.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <Button asChild className="rounded-full"><Link to="/">Browse shop</Link></Button>
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
          <ShoppingBag className="h-7 w-7" /> MaisonFemme
        </Link>
        <div>
          <h1 className="text-5xl font-display font-extrabold leading-tight">
            Join the<br />MaisonFemme circle.
          </h1>
          <p className="mt-4 text-lg opacity-90 max-w-md">
            Save your favorites, track orders and get first access to new drops.
          </p>
        </div>
        <p className="text-sm opacity-80">© {new Date().getFullYear()} MaisonFemme</p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <Link to="/" className="lg:hidden flex items-center gap-2 font-display font-bold text-xl text-primary mb-8">
            <ShoppingBag className="h-6 w-6" /> MaisonFemme
          </Link>
          <h2 className="text-3xl font-display font-bold">Create your account</h2>
          <p className="mt-2 text-muted-foreground">Accounts are reviewed by our team before first sign in.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Doe" />
              {errors.fullName && <p className="text-xs text-destructive">{errors.fullName}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input id="password" type={showPw ? "text" : "password"}
                  value={password} onChange={(e) => setPassword(e.target.value)} />
                <button type="button" onClick={() => setShowPw((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPw ? "Hide password" : "Show password"}>
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input id="confirm" type={showPw ? "text" : "password"}
                value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              {errors.confirm && <p className="text-xs text-destructive">{errors.confirm}</p>}
            </div>
            <Button type="submit" disabled={loading} className="w-full h-11 rounded-full text-base">
              {loading ? "Submitting…" : "Create account"}
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
