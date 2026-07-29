import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribes to Postgres changes on the given tables and invalidates the
 * supplied TanStack Query keys whenever anything changes. Server functions
 * stay the single source of truth — we only nudge the cache.
 *
 * One channel per hook instance, torn down on unmount.
 */
export function useRealtimeSync(tables: string[], queryKeys: string[][]) {
  const qc = useQueryClient();
  const tableKey = tables.join(",");
  const keySig = JSON.stringify(queryKeys);

  useEffect(() => {
    const list = tableKey.split(",").filter(Boolean);
    const keys: string[][] = JSON.parse(keySig);
    const channel = supabase.channel(`sync:${list.join("-")}:${Math.random().toString(36).slice(2)}`);

    for (const table of list) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, () => {
        for (const key of keys) qc.invalidateQueries({ queryKey: key });
      });
    }

    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc, tableKey, keySig]);
}
