import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { BrandLogo } from "@/components/Brand";
import authBag from "@/assets/auth-bag.jpg";


export const Route = createFileRoute("/signup")({
  ssr: false,
  component: SignupPage,
});

const schema = z
  .object({
    fullName: z.string().trim().min(2, "Please enter your full name").max(100),
    username: z.string().trim().min(2, "Choose a username").max(60),
    email: z.string().trim().email("Enter a valid email").max(255),
    phone: z.string().trim().min(6, "Enter a phone number").max(30),
    age: z.coerce.number().int().min(13, "You must be at least 13").max(120),
    state: z.string().trim().min(2, "State is required").max(60),
    city: z.string().trim().max(60).optional().or(z.literal("")),
    password: z.string().min(8, "Password must be at least 8 characters").max(72),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Passwords don't match",
    path: ["confirm"],
  });

function SignupPage() {
  const [form, setForm] = useState({
    fullName: "", username: "", email: "", phone: "", age: "",
    state: "", city: "", password: "", confirm: "",
  });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function set<K extends keyof typeof form>(k: K, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => (errs[i.path[0] as string] = i.message));
      setErrors(errs);
      return;
    }
    setErrors({});
    setLoading(true);
    const d = parsed.data;
    const { error } = await supabase.auth.signUp({
      email: d.email,
      password: d.password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          full_name: d.fullName,
          username: d.username,
          phone: d.phone,
          age: d.age,
          state: d.state,
          city: d.city ?? "",
          requested_role: "customer",
        },
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
            <BrandLogo className="h-9 w-9" />
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
      <div className="hidden lg:flex flex-col justify-between p-12 text-white relative overflow-hidden">
        <img
          src={authBag}
          alt="Luxury designer handbag"
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
            Join the<br />PameLuxury circle.
          </h1>
          <p className="mt-4 text-lg opacity-90 max-w-md">
            Save your favorites, track orders and get first access to new drops.
          </p>
        </div>
        <p className="relative z-10 text-sm opacity-80">© {new Date().getFullYear()} PameLuxury</p>
      </div>



      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <Link to="/" className="lg:hidden flex items-center gap-2 font-display font-bold text-xl text-primary mb-8">
            <BrandLogo className="h-8 w-8" /> PameLuxury
          </Link>
          <h2 className="text-3xl font-display font-bold">Create your account</h2>
          <p className="mt-2 text-muted-foreground">Accounts are reviewed by our team before first sign in.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4" noValidate>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label>Full name</Label>
                <Input value={form.fullName} onChange={(e) => set("fullName", e.target.value)} placeholder="Jane Doe" />
                {errors.fullName && <p className="text-xs text-destructive">{errors.fullName}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Username</Label>
                <Input value={form.username} onChange={(e) => set("username", e.target.value)} placeholder="janed" />
                {errors.username && <p className="text-xs text-destructive">{errors.username}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Age</Label>
                <Input type="number" min={13} value={form.age} onChange={(e) => set("age", e.target.value)} />
                {errors.age && <p className="text-xs text-destructive">{errors.age}</p>}
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="you@example.com" />
                {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+234…" />
                {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>State</Label>
                <Input value={form.state} onChange={(e) => set("state", e.target.value)} placeholder="Lagos" />
                {errors.state && <p className="text-xs text-destructive">{errors.state}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>City <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="Ikeja" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Password</Label>
                <div className="relative">
                  <Input type={showPw ? "text" : "password"} value={form.password} onChange={(e) => set("password", e.target.value)} />
                  <button type="button" onClick={() => setShowPw((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showPw ? "Hide password" : "Show password"}>
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Confirm password</Label>
                <Input type={showPw ? "text" : "password"} value={form.confirm} onChange={(e) => set("confirm", e.target.value)} />
                {errors.confirm && <p className="text-xs text-destructive">{errors.confirm}</p>}
              </div>
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
