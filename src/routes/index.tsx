import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    // Client-side redirect only (no SSR — no session on server).
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/shoes" });
    throw redirect({ to: "/login" });
  },
  ssr: false,
  component: () => null,
});
