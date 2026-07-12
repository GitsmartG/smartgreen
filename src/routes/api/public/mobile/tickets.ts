import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { ticketRowToDTO } from "@/lib/tickets-sync.functions";
import { buildCors, requireApiKey } from "@/lib/api-auth";
import { findMatchForTicket, gradePalpite } from "@/lib/auto-settle";
import type { LiveMatch } from "@/lib/livescores.functions";
import type { Ticket, TipStatus } from "@/lib/tickets-store";

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

type TicketRow = Database["public"]["Tables"]["tickets"]["Row"];

type MatchPayload = {
  leagues?: Array<{
    matches?: Array<{
      id: string;
      status: string;
      live: boolean;
      finished: boolean;
      home: { name: string; goals: number | null; id?: string; image?: string };
      away: { name: string; goals: number | null; id?: string; image?: string };
    }>;
  }>;
};

function brISOFromMs(ms: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
}

function ticketDateISO(row: TicketRow): string | null {
  const startMs = Number(row.start_ms);
  if (Number.isFinite(startMs)) return brISOFromMs(startMs);
  const raw = String(row.match_date || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}

function rowToTicket(row: TicketRow): Ticket {
  const status = ["aguardando", "ao_vivo", "green", "red"].includes(row.status)
    ? (row.status as TipStatus)
    : "aguardando";
  return {
    id: row.id,
    status,
    type: row.type === "Múltipla" ? "Múltipla" : "Simples",
    league: row.league ?? "",
    event: row.event ?? "",
    palpite: row.palpite ?? "",
    odd: Number(row.odd) || 1,
    banca: Number(row.banca) || 0,
    esporte: row.esporte ?? "Futebol",
    date: row.match_date ?? "",
    entradas: Number(row.entradas) || 1,
    parceiro: row.parceiro === "seubet" || row.parceiro === "h2bet" ? row.parceiro : undefined,
    url: row.url ?? undefined,
    createdAtMs: row.created_at_ms == null ? undefined : Number(row.created_at_ms),
    startMs: row.start_ms == null ? null : Number(row.start_ms),
    score1: row.score1,
    score2: row.score2,
    team1Logo: row.team1_logo ?? undefined,
    team2Logo: row.team2_logo ?? undefined,
    legResults: undefined,
    legStatuses: Array.isArray(row.leg_statuses) ? (row.leg_statuses as TipStatus[]) : undefined,
    resultCheckedAtMs: row.result_checked_at_ms == null ? undefined : Number(row.result_checked_at_ms),
  };
}

function payloadToLiveMatches(payload?: MatchPayload): LiveMatch[] {
  return (payload?.leagues ?? []).flatMap((league) =>
    (league.matches ?? []).map((match) => ({
      id: match.id,
      status: match.status,
      team1: match.home?.name ?? "",
      team2: match.away?.name ?? "",
      team1Logo: match.home?.image,
      team2Logo: match.away?.image,
      team1Id: match.home?.id,
      team2Id: match.away?.id,
      score1: match.home?.goals ?? null,
      score2: match.away?.goals ?? null,
      minute: match.live ? match.status : undefined,
      live: match.live,
      finished: match.finished,
    })),
  );
}

async function loadTicketMatches(rows: TicketRow[]): Promise<LiveMatch[]> {
  const dates = Array.from(new Set(rows.map(ticketDateISO).filter((date): date is string => Boolean(date)))).slice(0, 8);
  if (!dates.length) return [];
  const { readCachedDaily, refreshDailyMatches } = await import("@/lib/daily-matches.server");
  const matches: LiveMatch[] = [];
  for (const date of dates) {
    try {
      const cached = await readCachedDaily(date);
      const payload = cached?.payload ?? (await refreshDailyMatches(date)).payload;
      matches.push(...payloadToLiveMatches(payload));
    } catch {
      // Se uma data falhar, mantém os tickets como estão em vez de derrubar a API.
    }
  }
  return matches;
}

async function settleTicketRows(rows: TicketRow[]): Promise<TicketRow[]> {
  const pendingRows = rows.filter((row) => row.status !== "green" && row.status !== "red");
  if (!pendingRows.length) return rows;
  const matches = await loadTicketMatches(pendingRows);
  if (!matches.length) return rows;

  const nowMs = Date.now();
  const patches: Array<Partial<TicketRow> & { id: string }> = [];
  const settled = rows.map((row) => {
    if (row.status === "green" || row.status === "red") return row;
    const ticket = rowToTicket(row);
    const match = findMatchForTicket(ticket, matches);
    if (!match) return row;
    const graded = gradePalpite(ticket.palpite, match, ticket);
    const nextStatus: TipStatus | null = graded ?? (match.live && !match.finished ? "ao_vivo" : null);
    const patch: Partial<TicketRow> & { id: string } = {
      id: row.id,
      score1: match.score1,
      score2: match.score2,
      team1_logo: match.team1Logo ?? row.team1_logo,
      team2_logo: match.team2Logo ?? row.team2_logo,
      result_checked_at_ms: nowMs,
    };
    if (nextStatus && nextStatus !== row.status) {
      patch.status = nextStatus;
      if (row.type !== "Múltipla") patch.leg_statuses = [nextStatus];
    }
    const changed = Object.entries(patch).some(([key, value]) => key !== "id" && value !== row[key as keyof TicketRow]);
    if (!changed) return row;
    patches.push(patch);
    return { ...row, ...patch } as TicketRow;
  });

  if (patches.length) {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      for (const patch of patches) {
        const { id, ...update } = patch;
        await supabaseAdmin.from("tickets").update({ ...update, updated_at: new Date().toISOString() }).eq("id", id);
      }
    } catch {
      // A resposta já sai corrigida; persistência falhando não deve quebrar o app mobile.
    }
  }

  return settled;
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
            .limit(limit)
            .or(`scheduled_at_ms.is.null,scheduled_at_ms.lte.${Date.now()}`);

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
              // match_date é texto humano ("09 de jul. de 2026"); filtramos por start_ms (bigint em ms UTC)
              const fromMs = new Date(range.fromUtc).getTime();
              const toMs = new Date(range.toUtc).getTime();
              query = query.gte("start_ms", fromMs).lte("start_ms", toMs);
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

          const settledRows = await settleTicketRows((data ?? []) as TicketRow[]);
          const tickets = settledRows.map((r) => ticketRowToDTO(r as never));
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
