import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { ticketRowToDTO } from "@/lib/tickets-sync.functions";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const Route = createFileRoute("/api/public/mobile/tickets/$id")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ params }) => {
        try {
          const sb = createClient<Database>(
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_PUBLISHABLE_KEY!,
            { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
          );
          const { data, error } = await sb
            .from("tickets")
            .select("*")
            .eq("id", params.id)
            .maybeSingle();
          if (error) throw error;
          if (!data) {
            return new Response(JSON.stringify({ ok: false, error: "Ticket não encontrado" }), {
              status: 404,
              headers: { "Content-Type": "application/json", ...CORS },
            });
          }
          return new Response(
            JSON.stringify({ ok: true, ticket: ticketRowToDTO(data as never) }),
            { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=5", ...CORS } },
          );
        } catch (e) {
          return new Response(
            JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "erro" }),
            { status: 500, headers: { "Content-Type": "application/json", ...CORS } },
          );
        }
      },
    },
  },
});
