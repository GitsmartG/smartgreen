// Diagnóstico: bate nesse endpoint no Vercel pra ver o que o servidor enxerga.
// GET /api/public/debug/api-key?probe=<sua_chave>
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { buildCors } from "@/lib/api-auth";

export const Route = createFileRoute("/api/public/debug/api-key")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) =>
        new Response(null, { status: 204, headers: buildCors(request) }),
      GET: async ({ request }) => {
        const cors = buildCors(request);
        const url = new URL(request.url);
        const probe = (url.searchParams.get("probe") || "").trim();

        const supabaseUrl = process.env.SUPABASE_URL || null;
        const hasPub = Boolean(process.env.SUPABASE_PUBLISHABLE_KEY);
        const hasService = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

        let projectHost: string | null = null;
        try { projectHost = supabaseUrl ? new URL(supabaseUrl).host : null; } catch { /* noop */ }

        const out: Record<string, unknown> = {
          ok: true,
          env: {
            SUPABASE_URL_host: projectHost,          // deve ser wusauvbdpwdbxcmobudl.supabase.co
            SUPABASE_PUBLISHABLE_KEY: hasPub,
            SUPABASE_SERVICE_ROLE_KEY: hasService,
          },
        };

        // Tenta validar a chave do mesmo jeito que a API mobile valida: chave pública + RLS.
        try {
          if (!probe) {
            out.probeRequired = true;
          } else {
            const sb = createClient<Database>(
              process.env.SUPABASE_URL!,
              process.env.SUPABASE_PUBLISHABLE_KEY!,
              {
                auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
                global: { headers: { "x-api-key": probe } },
              },
            );
            const { data, error } = await sb
            .from("api_keys")
              .select("id")
              .eq("key", probe)
              .eq("active", true)
              .maybeSingle();
            if (error) {
              out.dbError = error.message;
            } else {
              out.probeMatches = Boolean(data);
              out.probePrefix = probe.slice(0, 10) + "...";
              out.probeLen = probe.length;
            }
          }
        } catch (e) {
          out.readError = e instanceof Error ? e.message : String(e);
        }

        return new Response(JSON.stringify(out, null, 2), {
          status: 200,
          headers: { "Content-Type": "application/json", ...cors },
        });
      },
    },
  },
});
