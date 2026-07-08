export type TipStatus = "aguardando" | "ao_vivo" | "green" | "red";
export type Parceiro = "seubet" | "h2bet";

export type Ticket = {
  id: string;
  status: TipStatus;
  type: "Simples" | "Múltipla";
  league: string;
  event: string;
  palpite: string;
  odd: number;
  banca: number;
  esporte: string;
  date: string;
  entradas: number;
  parceiro?: Parceiro;
  url?: string;
  createdAtMs?: number;
  startMs?: number | null;
  score1?: number | null;
  score2?: number | null;
  team1Logo?: string;
  team2Logo?: string;
  legResults?: Record<number, TicketLegResult>;
  resultCheckedAtMs?: number;
  legStatuses?: TipStatus[];
};

export type TicketLegResult = {
  matchId?: string;
  live?: boolean;
  finished?: boolean;
  score1?: number | null;
  score2?: number | null;
  minute?: string;
  team1?: string;
  team2?: string;
  team1Logo?: string;
  team2Logo?: string;
  team1Id?: string;
  team2Id?: string;
  swapped?: boolean;
  status?: TipStatus;
};

const STORAGE_KEY = "sg-tickets";
const EVENT = "sg-tickets:changed";

export function loadTickets(): Ticket[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizeTicket).filter(isTicket) : [];
  } catch {
    return [];
  }
}

export function saveTickets(tickets: Ticket[] | undefined | null) {
  if (typeof window === "undefined") return;
  const safeTickets = Array.isArray(tickets) ? tickets.map(normalizeTicket).filter(isTicket) : [];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(safeTickets));
  window.dispatchEvent(new Event(EVENT));
  // Sincroniza com backend (fire-and-forget). Se falhar (offline / não logado), ignora.
  void syncTicketsToBackend(safeTickets);
}

let syncTimer: ReturnType<typeof setTimeout> | null = null;
async function syncTicketsToBackend(tickets: Ticket[]) {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data } = await supabase.auth.getSession();
      if (!data.session) return; // não logado — não sincroniza
      const { syncAllTickets } = await import("./tickets-sync.functions");
      await syncAllTickets({ data: { tickets } });
    } catch {
      /* offline ou erro — próxima chamada tenta de novo */
    }
  }, 400);
}


function normalizeTicket(value: unknown): Ticket | null {
  if (!value || typeof value !== "object") return null;
  const t = value as Partial<Ticket> & Record<string, unknown>;
  const event = String(t.event || "Evento não informado");
  const rawEntradas = Number(t.entradas);
  const eventLegs = event
    .replace(/^\s*(m[uú]ltipla\s*[:\-]?\s*)/i, "")
    .split(/\s*\+\s*/)
    .map((part) => part.trim())
    .filter(Boolean).length;
  const detectedMultipla =
    t.type === "Múltipla" ||
    (Number.isFinite(rawEntradas) && rawEntradas > 1) ||
    /m[uú]ltipla|multipla/i.test(event);
  const status: TipStatus =
    t.status === "green" || t.status === "red" || t.status === "ao_vivo" || t.status === "aguardando"
      ? t.status
      : "aguardando";
  const type = detectedMultipla ? "Múltipla" : "Simples";
  const odd = Number(t.odd);
  const banca = Number(t.banca);
  const startMs = Number(t.startMs);
  const score1 = Number(t.score1);
  const score2 = Number(t.score2);
  const entradas = Number.isFinite(rawEntradas) ? rawEntradas : 1;

  return {
    id: String(t.id || crypto.randomUUID()).slice(0, 12).toUpperCase(),
    status,
    type,
    league: String(t.league || ""),
    event,
    palpite: String(t.palpite || ""),
    odd: Number.isFinite(odd) && odd > 0 ? odd : 1,
    banca: Number.isFinite(banca) ? banca : 0,
    esporte: String(t.esporte || "Futebol"),
    date: String(t.date || ""),
    entradas: detectedMultipla ? Math.max(2, entradas, eventLegs) : Math.max(1, entradas),
    parceiro: t.parceiro === "seubet" || t.parceiro === "h2bet" ? t.parceiro : undefined,
    url: typeof t.url === "string" ? t.url : undefined,
    createdAtMs: Number.isFinite(Number(t.createdAtMs)) ? Number(t.createdAtMs) : undefined,
    startMs: Number.isFinite(startMs) ? startMs : null,
    score1: Number.isFinite(score1) ? score1 : null,
    score2: Number.isFinite(score2) ? score2 : null,
    team1Logo: normalizeLogo(t.team1Logo),
    team2Logo: normalizeLogo(t.team2Logo),
    legResults: normalizeLegResults(t.legResults),
    resultCheckedAtMs: Number.isFinite(Number(t.resultCheckedAtMs)) ? Number(t.resultCheckedAtMs) : undefined,
    legStatuses: Array.isArray(t.legStatuses)
      ? (t.legStatuses as unknown[]).map((s) =>
          s === "green" || s === "red" || s === "ao_vivo" ? (s as TipStatus) : ("aguardando" as TipStatus),
        )
      : undefined,
  };
}

function normalizeLogo(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeLegResults(value: unknown): Record<number, TicketLegResult> | undefined {
  if (!value || typeof value !== "object") return undefined;
  const out: Record<number, TicketLegResult> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const idx = Number(key);
    if (!Number.isInteger(idx) || idx < 0 || !raw || typeof raw !== "object") continue;
    const leg = raw as Record<string, unknown>;
    const score1 = Number(leg.score1);
    const score2 = Number(leg.score2);
    const status = leg.status === "green" || leg.status === "red" || leg.status === "ao_vivo" ? leg.status : "aguardando";
    out[idx] = {
      matchId: typeof leg.matchId === "string" ? leg.matchId : undefined,
      live: Boolean(leg.live),
      finished: Boolean(leg.finished),
      score1: Number.isFinite(score1) ? score1 : null,
      score2: Number.isFinite(score2) ? score2 : null,
      minute: typeof leg.minute === "string" ? leg.minute : undefined,
      team1: typeof leg.team1 === "string" ? leg.team1 : undefined,
      team2: typeof leg.team2 === "string" ? leg.team2 : undefined,
      team1Logo: normalizeLogo(leg.team1Logo),
      team2Logo: normalizeLogo(leg.team2Logo),
      team1Id: typeof leg.team1Id === "string" ? leg.team1Id : undefined,
      team2Id: typeof leg.team2Id === "string" ? leg.team2Id : undefined,
      swapped: Boolean(leg.swapped),
      status,
    };
  }
  return Object.keys(out).length ? out : undefined;
}

function isTicket(value: Ticket | null): value is Ticket {
  return value !== null;
}

export function subscribeTickets(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => cb();
  window.addEventListener(EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}
