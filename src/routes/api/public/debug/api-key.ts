// Diagnóstico: bate nesse endpoint no Vercel pra ver o que o servidor enxerga.
// GET /api/public/debug/api-key?probe=<sua_chave>
import { createFileRoute } from "@tanstack/react-router";
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

        // Tenta ler api_keys via service role
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data, error } = await supabaseAdmin
            .from("api_keys")
            .select("key,active")
            .eq("active", true);
          if (error) {
            out.dbError = error.message;
          } else {
            const keys = (data ?? []).map((r) => r.key as string);
            out.activeKeysCount = keys.length;
            out.keyPrefixes = keys.map((k) => k.slice(0, 10) + "...");
            if (probe) {
              out.probeMatches = keys.includes(probe);
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
