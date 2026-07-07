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
  resultCheckedAtMs?: number;
  legStatuses?: TipStatus[];
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
}

function normalizeTicket(value: unknown): Ticket | null {
  if (!value || typeof value !== "object") return null;
  const t = value as Partial<Ticket> & Record<string, unknown>;
  const status: TipStatus =
    t.status === "green" || t.status === "red" || t.status === "ao_vivo" || t.status === "aguardando"
      ? t.status
      : "aguardando";
  const type = t.type === "Múltipla" ? "Múltipla" : "Simples";
  const odd = Number(t.odd);
  const banca = Number(t.banca);
  const startMs = Number(t.startMs);
  const score1 = Number(t.score1);
  const score2 = Number(t.score2);

  return {
    id: String(t.id || crypto.randomUUID()).slice(0, 12).toUpperCase(),
    status,
    type,
    league: String(t.league || ""),
    event: String(t.event || "Evento não informado"),
    palpite: String(t.palpite || ""),
    odd: Number.isFinite(odd) && odd > 0 ? odd : 1,
    banca: Number.isFinite(banca) ? banca : 0,
    esporte: String(t.esporte || "Futebol"),
    date: String(t.date || ""),
    entradas: Number.isFinite(Number(t.entradas)) ? Number(t.entradas) : 1,
    parceiro: t.parceiro === "seubet" || t.parceiro === "h2bet" ? t.parceiro : undefined,
    url: typeof t.url === "string" ? t.url : undefined,
    createdAtMs: Number.isFinite(Number(t.createdAtMs)) ? Number(t.createdAtMs) : undefined,
    startMs: Number.isFinite(startMs) ? startMs : null,
    score1: Number.isFinite(score1) ? score1 : null,
    score2: Number.isFinite(score2) ? score2 : null,
    team1Logo: typeof t.team1Logo === "string" ? t.team1Logo : undefined,
    team2Logo: typeof t.team2Logo === "string" ? t.team2Logo : undefined,
    resultCheckedAtMs: Number.isFinite(Number(t.resultCheckedAtMs)) ? Number(t.resultCheckedAtMs) : undefined,
  };
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
