import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AuthProfile = {
  id: string;
  email: string;
  full_name: string;
  username: string;
  status: string;
} | null;


/**
 * Shared, cached view of the signed-in customer (auth user + profile).
 * Every consumer reads the same query key so wishlist/cart state is always
 * scoped to the current account and resets on sign out.
 */
export function useAuthUser() {
  const qc = useQueryClient();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      qc.invalidateQueries({ queryKey: ["auth-user"] });
      qc.invalidateQueries({ queryKey: ["wishlist"] });
      qc.invalidateQueries({ queryKey: ["cart"] });
      qc.invalidateQueries({ queryKey: ["cart-count"] });
    });
    return () => sub.subscription.unsubscribe();
  }, [qc]);

  return useQuery({
    queryKey: ["auth-user"],
    staleTime: 30_000,
    queryFn: async (): Promise<AuthProfile> => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return null;
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, email, full_name, username, status")
        .eq("id", data.user.id)
        .maybeSingle();
      return {
        id: data.user.id,
        email: data.user.email ?? profile?.email ?? "",
        full_name: profile?.full_name ?? "",
        username: profile?.username ?? "",
        status: profile?.status ?? "pending",
      };

    },
  });
}
