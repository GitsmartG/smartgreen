import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { ticketRowToDTO } from "@/lib/tickets-sync.functions";
import { buildCors, requireApiKey } from "@/lib/api-auth";

const TZ = "America/Sao_Paulo";

function brtDateToUtcRange(dateISO: string): { fromUtc: string; toUtc: string } | null {
  // dateISO: YYYY-MM-DD interpreted in America/Sao_Paulo (BRT = UTC-3, sem DST)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return null;
  const from = new Date(`${dateISO}T00:00:00-03:00`);
  const to = new Date(`${dateISO}T23:59:59.999-03:00`);
  return { fromUtc: from.toISOString(), toUtc: to.toISOString() };
}

function resolveDateAlias(alias: string): string {
  const now = new Date();
  const brtNow = new Date(now.toLocaleString("en-US", { timeZone: TZ }));
  const offset: Record<string, number> = { today: 0, yesterday: -1, tomorrow: 1 };
  const delta = offset[alias] ?? 0;
  brtNow.setDate(brtNow.getDate() + delta);
  const y = brtNow.getFullYear();
  const m = String(brtNow.getMonth() + 1).padStart(2, "0");
  const d = String(brtNow.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

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
          const type = url.searchParams.get("type"); // Simples | Múltipla
          const dateParam = url.searchParams.get("date"); // today|yesterday|tomorrow|YYYY-MM-DD
          const since = url.searchParams.get("since"); // ISO — retorna updated_at > since (sync incremental)
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
          if (type === "Simples" || type === "Múltipla" || type === "Multipla") {
            query = query.eq("type", type === "Multipla" ? "Múltipla" : type);
          }
          if (dateParam) {
            const iso = /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
              ? dateParam
              : resolveDateAlias(dateParam);
            const range = brtDateToUtcRange(iso);
            if (range) {
              query = query.gte("match_date", range.fromUtc).lte("match_date", range.toUtc);
            }
          }
          if (since) {
            const d = new Date(since);
            if (!Number.isNaN(d.getTime())) {
              query = query.gt("updated_at", d.toISOString());
            }
          }

          const { data, error } = await query;
          if (error) throw error;

          const tickets = (data ?? []).map((r) => ticketRowToDTO(r as never));
          const counts = {
            total: tickets.length,
            aguardando: tickets.filter((t) => t.status === "aguardando").length,
            ao_vivo: tickets.filter((t) => t.status === "ao_vivo").length,
            green: tickets.filter((t) => t.status === "green").length,
            red: tickets.filter((t) => t.status === "red").length,
          };
          return new Response(
            JSON.stringify({
              ok: true,
              fetchedAt: new Date().toISOString(),
              count: tickets.length,
              counts,
              tickets,
            }),
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
