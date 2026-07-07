export type TipStatus = "ao_vivo" | "green" | "red";
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
};

const STORAGE_KEY = "sg-tickets";
const EVENT = "sg-tickets:changed";

export function loadTickets(): Ticket[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Ticket[]) : [];
  } catch {
    return [];
  }
}

export function saveTickets(tickets: Ticket[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
  window.dispatchEvent(new Event(EVENT));
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
