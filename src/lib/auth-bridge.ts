import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { supabaseAdminClient } from "@/integrations/supabase/admin-client";

// Attaches the appropriate Supabase bearer token to server-fn calls.
// On /admin routes, prefer the admin session; otherwise use the customer session.
export const attachSessionBridge = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    const path = typeof window !== "undefined" ? window.location.pathname : "";
    const preferAdmin = path.startsWith("/admin");

    let token: string | undefined;
    if (preferAdmin) {
      const { data } = await supabaseAdminClient.auth.getSession();
      token = data.session?.access_token;
      if (!token) {
        const { data: d2 } = await supabase.auth.getSession();
        token = d2.session?.access_token;
      }
    } else {
      const { data } = await supabase.auth.getSession();
      token = data.session?.access_token;
      if (!token) {
        const { data: d2 } = await supabaseAdminClient.auth.getSession();
        token = d2.session?.access_token;
      }
    }
    return next({ headers: token ? { Authorization: `Bearer ${token}` } : {} });
  },
);
