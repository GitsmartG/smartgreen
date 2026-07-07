import { createServerFn } from "@tanstack/react-start";

export type LiveMatch = {
  id: string;
  status: string;
  team1: string;
  team2: string;
  score1: number | null;
  score2: number | null;
  finished: boolean;
};

type StatpalMatch = Record<string, unknown>;

function pickString(obj: unknown, ...keys: string[]): string {
  if (!obj || typeof obj !== "object") return "";
  for (const k of keys) {
    const v = (obj as Record<string, unknown>)[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
    if (v && typeof v === "object") {
      const nested = (v as Record<string, unknown>).name ?? (v as Record<string, unknown>)["@name"];
      if (typeof nested === "string" && nested.trim()) return nested.trim();
    }
  }
  return "";
}

function parseScore(raw: string): [number | null, number | null] {
  const m = raw.match(/(\d+)\s*[-:x]\s*(\d+)/i);
  if (!m) return [null, null];
  return [Number(m[1]), Number(m[2])];
}

function normalizeMatch(raw: StatpalMatch): LiveMatch | null {
  const id = pickString(raw, "id", "@id", "match_id", "fixture_id");
  const team1 =
    pickString(raw, "home_name", "localteam", "home", "team1", "hometeam") ||
    pickString((raw as Record<string, unknown>).localteam, "name", "@name") ||
    pickString((raw as Record<string, unknown>).home, "name", "@name");
  const team2 =
    pickString(raw, "away_name", "visitorteam", "away", "team2", "awayteam") ||
    pickString((raw as Record<string, unknown>).visitorteam, "name", "@name") ||
    pickString((raw as Record<string, unknown>).away, "name", "@name");
  const status = pickString(raw, "status", "@status", "state", "time");
  const scoreRaw =
    pickString(raw, "score", "ft_score", "fs", "result") ||
    `${pickString((raw as Record<string, unknown>).localteam, "goals", "@goals")}-${pickString(
      (raw as Record<string, unknown>).visitorteam,
      "goals",
      "@goals",
    )}`;
  const [s1, s2] = parseScore(scoreRaw);
  if (!team1 || !team2) return null;
  const finished = /finish|ended|ft|full|after|aet|pen/i.test(status);
  return { id: id || `${team1}-${team2}`, status, team1, team2, score1: s1, score2: s2, finished };
}

function extractMatches(payload: unknown): LiveMatch[] {
  const out: LiveMatch[] = [];
  const walk = (node: unknown) => {
    if (!node) return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    if (typeof node !== "object") return;
    const rec = node as Record<string, unknown>;
    if ("localteam" in rec || "home_name" in rec || "hometeam" in rec) {
      const m = normalizeMatch(rec);
      if (m) out.push(m);
    }
    for (const v of Object.values(rec)) walk(v);
  };
  walk(payload);
  return out;
}

export const getSoccerLivescores = createServerFn({ method: "GET" }).handler(async () => {
  const key = process.env.STATPAL_API_KEY;
  if (!key) return { ok: false as const, error: "STATPAL_API_KEY não configurada", matches: [] };
  try {
    const res = await fetch(
      `https://statpal.io/api/v2/soccer/matches/live?access_key=${encodeURIComponent(key)}`,
      { headers: { accept: "application/json" } },
    );
    if (!res.ok) {
      return { ok: false as const, error: `HTTP ${res.status}`, matches: [] };
    }
    const data = await res.json().catch(() => null);
    const matches = extractMatches(data);
    return { ok: true as const, matches };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Falha na API", matches: [] };
  }
});
