import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";


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
  createdAt: string | null;
  createdAtTime: string | null;
  createdAtDate: string | null;
  startMs: number | null;
  score1: number | null;
  score2: number | null;
  team1Logo: string | null;
  team2Logo: string | null;
  team1: string | null;
  team2: string | null;
  legs: Array<{
    index: number;
    team1: string | null;
    team2: string | null;
    team1Logo: string | null;
    team2Logo: string | null;
    score1: number | null;
    score2: number | null;
    minute: string | null;
    status: "aguardando" | "ao_vivo" | "green" | "red";
    live: boolean;
    finished: boolean;
  }>;
  legResults: unknown;
  legStatuses: string[] | null;
  resultCheckedAtMs: number | null;
  scheduledAtMs: number | null;
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
  const legs = buildLegs(row.event ?? "", row.leg_results, row.leg_statuses, {
    team1Logo: row.team1_logo,
    team2Logo: row.team2_logo,
    score1: row.score1,
    score2: row.score2,
    status: (["aguardando", "ao_vivo", "green", "red"].includes(row.status) ? row.status : "aguardando") as PublicTicketDTO["status"],
  });
  const first = legs[0];
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
    createdAt: num(row.created_at_ms) != null ? new Date(num(row.created_at_ms)!).toISOString() : null,
    createdAtTime: num(row.created_at_ms) != null
      ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(num(row.created_at_ms)!))
      : null,
    createdAtDate: num(row.created_at_ms) != null
      ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(num(row.created_at_ms)!))
      : null,
    startMs: num(row.start_ms),
    score1: row.score1,
    score2: row.score2,
    team1Logo: row.team1_logo,
    team2Logo: row.team2_logo,
    team1: first?.team1 ?? null,
    team2: first?.team2 ?? null,
    legs,
    legResults: (row.leg_results as unknown) ?? null,
    legStatuses: Array.isArray(row.leg_statuses) ? (row.leg_statuses as string[]) : null,
    resultCheckedAtMs: num(row.result_checked_at_ms),
    updatedAt: row.updated_at,
  };
}

function splitTeams(s: string): { team1: string | null; team2: string | null } {
  const m = s.match(/^\s*(.+?)\s+(?:vs\.?|x|×|-)\s+(.+?)\s*$/i);
  if (!m) return { team1: null, team2: null };
  return { team1: m[1].trim() || null, team2: m[2].trim() || null };
}

function buildLegs(
  event: string,
  legResultsRaw: unknown,
  legStatusesRaw: unknown,
  fallback: {
    team1Logo: string | null;
    team2Logo: string | null;
    score1: number | null;
    score2: number | null;
    status: PublicTicketDTO["status"];
  },
): PublicTicketDTO["legs"] {
  const cleaned = event.replace(/^\s*(m[uú]ltipla\s*[:\-]?\s*)/i, "");
  const parts = cleaned.split(/\s*\+\s*/).map((p) => p.trim()).filter(Boolean);
  const legResults = (legResultsRaw && typeof legResultsRaw === "object")
    ? (legResultsRaw as Record<string, Record<string, unknown>>)
    : {};
  const legStatuses = Array.isArray(legStatusesRaw) ? (legStatusesRaw as string[]) : [];
  return parts.map((part, idx) => {
    const { team1, team2 } = splitTeams(part);
    const lr = legResults[String(idx)] ?? {};
    const num = (v: unknown): number | null => {
      const n = typeof v === "string" ? Number(v) : (v as number);
      return Number.isFinite(n) ? n : null;
    };
    const st = legStatuses[idx];
    const status = (["aguardando", "ao_vivo", "green", "red"].includes(st)
      ? st
      : idx === 0
        ? fallback.status
        : "aguardando") as PublicTicketDTO["status"];
    return {
      index: idx,
      team1: (typeof lr.team1 === "string" && lr.team1) || team1,
      team2: (typeof lr.team2 === "string" && lr.team2) || team2,
      team1Logo: (typeof lr.team1Logo === "string" && lr.team1Logo) || (idx === 0 ? fallback.team1Logo : null),
      team2Logo: (typeof lr.team2Logo === "string" && lr.team2Logo) || (idx === 0 ? fallback.team2Logo : null),
      score1: num(lr.score1) ?? (idx === 0 ? fallback.score1 : null),
      score2: num(lr.score2) ?? (idx === 0 ? fallback.score2 : null),
      minute: typeof lr.minute === "string" ? lr.minute : null,
      status,
      live: Boolean(lr.live),
      finished: Boolean(lr.finished),
    };
  });
}



// Sincroniza a lista inteira do frontend (localStorage) para o banco.
// Faz upsert de tudo. Só remove órfãos quando `prune=true` (default false)
// pra não apagar bilhetes vindos de outro device.
export const syncAllTickets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { tickets: TicketInput[]; prune?: boolean }) => ({
    tickets: Array.isArray(d.tickets) ? d.tickets : [],
    prune: Boolean(d.prune),
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
      const { error: upErr } = await context.supabase
        .from("tickets")
        .upsert(rows as never, { onConflict: "id" });
      if (upErr) throw upErr;
    }

    if (data.prune) {
      const ids = rows.map((r) => r.id);
      const del = context.supabase.from("tickets").delete();
      const { error: delErr } = ids.length
        ? await del.not("id", "in", `(${ids.map((i) => `"${i.replace(/"/g, '""')}"`).join(",")})`)
        : await del.not("id", "is", null);
      if (delErr) throw delErr;
    }

    return { ok: true, count: rows.length };
  });

// Apaga um ticket específico (chamado ao remover no frontend).
export const deleteTicketRemote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => ({ id: String(d.id || "") }))
  .handler(async ({ data, context }) => {
    if (!data.id) return { ok: false as const, error: "id vazio" };
    const { error } = await context.supabase.from("tickets").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true as const };
  });

// Busca todos os tickets do banco (pra hidratar o frontend com dados de outros devices).
export const fetchAllTicketsRemote = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("tickets")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    const tickets = (data ?? []).map((r) => ticketRowToDTO(r as never));
    // serializa como JSON string pra escapar do type-check estrito de "unknown".
    return { ok: true as const, ticketsJson: JSON.stringify(tickets) };
  });
