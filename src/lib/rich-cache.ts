import type { RichMatchResponse } from "./soccer-details.functions";

const KEY = "sg-rich-cache-v1";
const LIVE_TTL_MS = 60_000; // 1 min para jogo ao vivo
const FINISHED_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias
const NEG_TTL_MS = 5 * 60 * 1000; // 5 min para "não encontrado"

type Entry = {
  at: number;
  finished: boolean;
  data: RichMatchResponse;
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

export function cacheKey(team1: string, team2: string): string {
  const a = normalize(team1);
  const b = normalize(team2);
  return [a, b].sort().join("|");
}

function readAll(): Record<string, Entry> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, Entry>) : {};
  } catch {
    return {};
  }
}

function writeAll(store: Record<string, Entry>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // storage cheio: reseta
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* noop */
    }
  }
}

export function getCachedRich(team1: string, team2: string): RichMatchResponse | null {
  const key = cacheKey(team1, team2);
  const store = readAll();
  const entry = store[key];
  if (!entry) return null;
  const age = Date.now() - entry.at;
  const ttl = entry.finished
    ? FINISHED_TTL_MS
    : entry.data?.ok
      ? LIVE_TTL_MS
      : NEG_TTL_MS;
  if (age > ttl) return null;
  return entry.data;
}

export function setCachedRich(team1: string, team2: string, data: RichMatchResponse): void {
  const key = cacheKey(team1, team2);
  const store = readAll();
  const finished = !!(data.ok && data.match?.finished);
  store[key] = { at: Date.now(), finished, data };
  writeAll(store);
}

export function isFinishedCached(team1: string, team2: string): boolean {
  const key = cacheKey(team1, team2);
  const store = readAll();
  return !!store[key]?.finished;
}
