import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

// DTO puro (camelCase) devolvido pelo endpoint público, pro app mobile consumir.
export type PublicTicketDTO = {
  id: string;
  status: "aguardando" | "ao_vivo" | "green" | "red";
  type: "Simples" | "Múltipla";
  league: string;
  event: string;
  palpite: string;
  odd: number;
  banca: number;
  esporte: string;
  date: string;
  entradas: number;
  parceiro: "seubet" | "h2bet" | null;
  url: string | null;
  createdAtMs: number | null;
  startMs: number | null;
  score1: number | null;
  score2: number | null;
  team1Logo: string | null;
  team2Logo: string | null;
  legResults: unknown;
  legStatuses: string[] | null;
  resultCheckedAtMs: number | null;
  updatedAt: string;

};

// Payload aceito no upsert (mesmo formato do Ticket do frontend).
export type TicketInput = {
  id: string;
  status: string;
  type: string;
  league: string;
  event: string;
  palpite: string;
  odd: number;
  banca: number;
  esporte: string;
  date: string;
  entradas: number;
  parceiro?: string | null;
  url?: string | null;
  createdAtMs?: number | null;
  startMs?: number | null;
  score1?: number | null;
  score2?: number | null;
  team1Logo?: string | null;
  team2Logo?: string | null;
  legResults?: unknown;
  legStatuses?: unknown;
  resultCheckedAtMs?: number | null;
};

export function ticketRowToDTO(row: {
  id: string;
  status: string;
  type: string;
  league: string;
  event: string;
  palpite: string;
  odd: number | string;
  banca: number | string;
  esporte: string;
  match_date: string;
  entradas: number;
  parceiro: string | null;
  url: string | null;
  start_ms: number | string | null;
  score1: number | null;
  score2: number | null;
  team1_logo: string | null;
  team2_logo: string | null;
  leg_results: unknown;
  leg_statuses: unknown;
  result_checked_at_ms: number | string | null;
  created_at_ms: number | string | null;
  updated_at: string;
}): PublicTicketDTO {
  const num = (v: unknown): number | null => {
    if (v == null) return null;
    const n = typeof v === "string" ? Number(v) : (v as number);
    return Number.isFinite(n) ? n : null;
  };
  return {
    id: row.id,
    status: (["aguardando", "ao_vivo", "green", "red"].includes(row.status)
      ? row.status
      : "aguardando") as PublicTicketDTO["status"],
    type: row.type === "Múltipla" ? "Múltipla" : "Simples",
    league: row.league ?? "",
    event: row.event ?? "",
    palpite: row.palpite ?? "",
    odd: Number(row.odd) || 1,
    banca: Number(row.banca) || 0,
    esporte: row.esporte ?? "Futebol",
    date: row.match_date ?? "",
    entradas: row.entradas ?? 1,
    parceiro: row.parceiro === "seubet" || row.parceiro === "h2bet" ? row.parceiro : null,
    url: row.url ?? null,
    createdAtMs: num(row.created_at_ms),
    startMs: num(row.start_ms),
    score1: row.score1,
    score2: row.score2,
    team1Logo: row.team1_logo,
    team2Logo: row.team2_logo,
    legResults: (row.leg_results as unknown) ?? null,
    legStatuses: Array.isArray(row.leg_statuses) ? (row.leg_statuses as string[]) : null,

    resultCheckedAtMs: num(row.result_checked_at_ms),
    updatedAt: row.updated_at,
  };
}

function publicClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

// Server fn público — devolve DTOs (o mesmo shape do endpoint HTTP).
export const listPublicTickets = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  const { data, error } = await sb
    .from("tickets")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) return [] as PublicTicketDTO[];
  return (data ?? []).map((r) => ticketRowToDTO(r as never));
});

// Sincroniza a lista inteira do frontend (localStorage) para o banco.
// Faz upsert de tudo e apaga o que não estiver mais na lista, tudo em uma chamada.
export const syncAllTickets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { tickets: TicketInput[] }) => ({
    tickets: Array.isArray(d.tickets) ? d.tickets : [],
  }))
  .handler(async ({ data, context }) => {
    const rows = data.tickets.map((t) => ({
      id: String(t.id),
      status: String(t.status || "aguardando"),
      type: t.type === "Múltipla" ? "Múltipla" : "Simples",
      league: String(t.league || ""),
      event: String(t.event || ""),
      palpite: String(t.palpite || ""),
      odd: Number(t.odd) || 1,
      banca: Number(t.banca) || 0,
      esporte: String(t.esporte || "Futebol"),
      match_date: String(t.date || ""),
      entradas: Number(t.entradas) || 1,
      parceiro: t.parceiro ?? null,
      url: t.url ?? null,
      start_ms: t.startMs ?? null,
      score1: t.score1 ?? null,
      score2: t.score2 ?? null,
      team1_logo: t.team1Logo ?? null,
      team2_logo: t.team2Logo ?? null,
      leg_results: t.legResults ?? null,
      leg_statuses: t.legStatuses ?? null,
      result_checked_at_ms: t.resultCheckedAtMs ?? null,
      created_at_ms: t.createdAtMs ?? null,
      updated_at: new Date().toISOString(),
    }));

    if (rows.length) {
      const { error: upErr } = await context.supabase.from("tickets").upsert(rows as never);
      if (upErr) throw upErr;
    }

    // Apaga tickets do DB que não estão mais na lista local.
    const ids = rows.map((r) => r.id);
    const del = context.supabase.from("tickets").delete();
    const { error: delErr } = ids.length
      ? await del.not("id", "in", `(${ids.map((i) => `"${i.replace(/"/g, '""')}"`).join(",")})`)
      : await del.not("id", "is", null);
    if (delErr) throw delErr;

    return { ok: true, count: rows.length };
  });
