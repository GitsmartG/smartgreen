import type { LiveMatch } from "./livescores.functions";

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

function normalizeStatus(status: string): string {
  return status.trim().toLowerCase();
}

function normalizeMatch(raw: StatpalMatch): LiveMatch | null {
  const id = pickString(raw, "main_id", "id", "@id", "match_id", "fixture_id", "fallback_id_1", "fallback_id_2", "fallback_id_3");
  const home = (raw.home ?? raw.localteam ?? raw.hometeam ?? {}) as Record<string, unknown>;
  const away = (raw.away ?? raw.visitorteam ?? raw.awayteam ?? {}) as Record<string, unknown>;
  const team1 =
    pickString(raw, "home_name", "localteam", "home", "team1", "hometeam") ||
    pickString(home, "name", "@name");
  const team2 =
    pickString(raw, "away_name", "visitorteam", "away", "team2", "awayteam") ||
    pickString(away, "name", "@name");
  if (!team1 || !team2) return null;

  const status = pickString(raw, "status", "@status", "state", "time");
  const scoreRaw =
    pickString(raw, "score", "ft_score", "fs", "result") ||
    `${pickString(home, "goals", "@goals")}-${pickString(away, "goals", "@goals")}`;
  const [s1, s2] = parseScore(scoreRaw);
  const st = normalizeStatus(status);
  const finished = /^(ft|aet|pen|ended|finish|finished|full\s*time)$/.test(st) || /finish|ended|full/i.test(status);
  const notStarted = /^(ns|not\s*started|sched|scheduled|pending|tbd|postp|postponed|canc|cancelled)$/i.test(status);
  const live = !finished && !notStarted && (s1 != null || /^\d/.test(status) || /1h|2h|ht|half|live|et|extra/i.test(status));
  const team1Logo =
    pickString(raw, "home_image", "localteam_image", "home_logo", "team1Logo") ||
    pickString(home, "image", "logo", "crest", "badge") ||
    undefined;
  const team2Logo =
    pickString(raw, "away_image", "visitorteam_image", "away_logo", "team2Logo") ||
    pickString(away, "image", "logo", "crest", "badge") ||
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
    if (("home" in rec && "away" in rec) || "localteam" in rec || "home_name" in rec || "hometeam" in rec) {
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

export async function fetchSoccerLivescores() {
  const matches = await fetchStatpal("matches/live");
  const seen = new Set<string>();
  const merged: LiveMatch[] = [];
  for (const m of matches) {
    const key = `${m.team1}|${m.team2}|${m.id}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(m);
  }
  return { ok: true as const, matches: merged };
}