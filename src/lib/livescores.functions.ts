import { createServerFn } from "@tanstack/react-start";

export type LiveMatch = {
  id: string;
  status: string;
  team1: string;
  team2: string;
  team1Logo?: string;
  team2Logo?: string;
  score1: number | null;
  score2: number | null;
  minute?: string;
  live: boolean;
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
  const notStarted = /^(ns|not\s*started|sched|pending|tbd|postp|canc)/i.test(status);
  const live = !finished && !notStarted && (s1 != null || /^\d/.test(status) || /1h|2h|ht|half|live|et|extra/i.test(status));
  const team1Logo =
    pickString(raw, "home_image", "localteam_image") ||
    pickString((raw as Record<string, unknown>).home, "image", "logo", "crest") ||
    pickString((raw as Record<string, unknown>).localteam, "image", "logo", "crest") ||
    undefined;
  const team2Logo =
    pickString(raw, "away_image", "visitorteam_image") ||
    pickString((raw as Record<string, unknown>).away, "image", "logo", "crest") ||
    pickString((raw as Record<string, unknown>).visitorteam, "image", "logo", "crest") ||
    undefined;
  const minute = pickString(raw, "minute", "inj_minute", "elapsed", "time_status") || undefined;
  return {
    id: id || `${team1}-${team2}`,
    status,
    team1,
    team2,
    team1Logo,
    team2Logo,
    score1: s1,
    score2: s2,
    minute,
    live,
    finished,
  };
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

async function fetchStatpal(path: string): Promise<LiveMatch[]> {
  const key = process.env.STATPAL_API_KEY;
  if (!key) throw new Error("STATPAL_API_KEY não configurada");
  const res = await fetch(
    `https://statpal.io/api/v2/soccer/${path}?access_key=${encodeURIComponent(key)}`,
    { headers: { accept: "application/json" } },
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json().catch(() => null);
  return extractMatches(data);
}

// Live + results (finished today) — combinado para o poller acompanhar até o encerramento.
export const getSoccerLivescores = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const [liveRes, resultsRes] = await Promise.allSettled([
      fetchStatpal("matches/live"),
      fetchStatpal("matches/results"),
    ]);
    const live = liveRes.status === "fulfilled" ? liveRes.value : [];
    const done = resultsRes.status === "fulfilled"
      ? resultsRes.value.map((m) => ({ ...m, live: false, finished: true }))
      : [];
    if (!live.length && !done.length && liveRes.status === "rejected") {
      const err = liveRes.reason instanceof Error ? liveRes.reason.message : "Falha na API";
      return { ok: false as const, error: err, matches: [] };
    }
    // Live first — se o mesmo jogo aparecer nos dois, o ao vivo prevalece
    const seen = new Set<string>();
    const merged: LiveMatch[] = [];
    for (const m of [...live, ...done]) {
      const key = `${m.team1}|${m.team2}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(m);
    }
    return { ok: true as const, matches: merged };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Falha na API", matches: [] };
  }
});
