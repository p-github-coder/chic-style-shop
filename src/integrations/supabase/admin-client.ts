// Separate Supabase client for the admin console.
// Uses its own localStorage key so admin sessions are completely
// isolated from customer sessions in the same browser.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(key: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) new Headers(init.headers).forEach((v, k) => headers.set(k, v));
    if (isNewSupabaseApiKey(key) && headers.get("Authorization") === `Bearer ${key}`) {
      headers.delete("Authorization");
    }
    headers.set("apikey", key);
    return fetch(input, { ...init, headers });
  };
}

function create() {
  const url = import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars for admin client");
  return createClient<Database>(url, key, {
    global: { fetch: createSupabaseFetch(key) },
    auth: {
      storage: typeof window !== "undefined" ? localStorage : undefined,
      storageKey: "sb-admin-auth-token",
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

let _client: ReturnType<typeof create> | undefined;
export const supabaseAdminClient = new Proxy({} as ReturnType<typeof create>, {
  get(_, prop, r) {
    if (!_client) _client = create();
    return Reflect.get(_client, prop, r);
  },
});
