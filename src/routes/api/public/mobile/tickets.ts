import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { ticketRowToDTO } from "@/lib/tickets-sync.functions";
import { buildCors, requireApiKey } from "@/lib/api-auth";

export const Route = createFileRoute("/api/public/mobile/tickets")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) =>
        new Response(null, { status: 204, headers: buildCors(request) }),
      GET: async ({ request }) => {
        const cors = buildCors(request);
        const unauth = await requireApiKey(request);
        if (unauth) return unauth;
        try {
          const url = new URL(request.url);
          const status = url.searchParams.get("status");
          const limit = Math.min(Number(url.searchParams.get("limit")) || 100, 500);

          const sb = createClient<Database>(
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_PUBLISHABLE_KEY!,
            { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
          );

          let query = sb
            .from("tickets")
            .select("*")
            .order("updated_at", { ascending: false })
            .limit(limit);

          if (status && ["aguardando", "ao_vivo", "green", "red"].includes(status)) {
            query = query.eq("status", status);
          }

          const { data, error } = await query;
          if (error) throw error;

          const tickets = (data ?? []).map((r) => ticketRowToDTO(r as never));
          return new Response(
            JSON.stringify({ ok: true, fetchedAt: new Date().toISOString(), count: tickets.length, tickets }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                "Cache-Control": "public, max-age=5",
                ...cors,
              },
            },
          );
        } catch (e) {
          return new Response(
            JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "erro" }),
            { status: 500, headers: { "Content-Type": "application/json", ...cors } },
          );
        }
      },
    },
  },
});
