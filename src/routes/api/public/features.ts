import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const KEYS = ["jogos", "ligas", "banca", "parceiros", "indique"] as const;
type Key = (typeof KEYS)[number];

export const Route = createFileRoute("/api/public/features")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async () => {
        const out: Record<Key, boolean> = {
          jogos: true, ligas: true, banca: true, parceiros: true, indique: true,
        };
        try {
          const sb = createClient<Database>(
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_PUBLISHABLE_KEY!,
            { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
          );
          const { data } = await sb.from("feature_flags").select("key,enabled");
          for (const row of data ?? []) {
            if ((KEYS as readonly string[]).includes(row.key)) {
              out[row.key as Key] = Boolean(row.enabled);
            }
          }
        } catch { /* fallback DEFAULTS */ }
        return new Response(JSON.stringify(out), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=10",
            ...CORS,
          },
        });
      },
    },
  },
});
