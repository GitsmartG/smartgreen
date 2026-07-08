import { createServerFn } from "@tanstack/react-start";

export type MatchEvent = {
  id: string;
  type: string; // goal, yellowcard, redcard, yellowred, substitution, penalty, etc
  team: "home" | "away" | string;
  minute: string;
  extraMin?: string;
  player: string;
  assist?: string;
  result?: string;
};

export type MatchPrediction = {
  homeWin?: number; // 0..1
  draw?: number;
  awayWin?: number;
  advice?: string;
};


export type LiveOdds = {
  market: string;
  selection: string;
  odd: number;
};

export type RichMatch = {
  matchId: string;
  status: string; // "1H", "2H", "FT", "HT", etc
  minute?: string;
  date: string;
  time: string;
  venue?: string;
  league?: string;
  home: { id: string; name: string; goals: number | null };
  away: { id: string; name: string; goals: number | null };
  ht?: { home: number; away: number } | null;
  ft?: { home: number; away: number } | null;
  events: MatchEvent[];
  hasLiveStats: boolean;
  finished: boolean;
};

export type RichMatchResponse = {
  ok: boolean;
  error?: string;
  match?: RichMatch;
  prediction?: MatchPrediction | null;
  odds?: LiveOdds[] | null;
};

// -------- helpers --------

function normalize(s: string): string {
  const base = s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return base
    .replace(/\begito\b/g, "egypt")
    .replace(/\bestados unidos\b|\beua\b/g, "usa")
    .replace(/\bbelgica\b/g, "belgium")
    .replace(/\balemanha\b/g, "germany")
    .replace(/\bespanha\b/g, "spain")
    .replace(/\bfranca\b/g, "france")
    .replace(/\binglaterra\b/g, "england")
    .replace(/\bitalia\b/g, "italy")
    .replace(/\bholanda\b|\bpaises baixos\b/g, "netherlands");
}

function tokens(s: string): string[] {
  return normalize(s).split(" ").filter((t) => t.length >= 3);
}

function nameMatch(a: string, b: string): boolean {
  const ta = new Set(tokens(a));
  const tb = tokens(b);
  if (!tb.length) return false;
  let hits = 0;
  for (const t of tb) if (ta.has(t)) hits++;
  return hits >= 1;
}

function toInt(v: unknown): number | null {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  return null;
}

function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

async function statpalGet(path: string, params: Record<string, string> = {}) {
  const key = process.env.STATPAL_API_KEY;
  if (!key) throw new Error("STATPAL_API_KEY não configurada");
  const qs = new URLSearchParams({ access_key: key, ...params });
  const res = await fetch(`https://statpal.io/api/v2/soccer/${path}?${qs}`, {
    headers: { accept: "application/json" },
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false as const, status: res.status, error: "resposta não-JSON", data: null };
  }
  if (!res.ok || (json && typeof json === "object" && "error" in (json as object))) {
    const rawErr = (json as { error?: unknown })?.error;
    let err: string;
    if (typeof rawErr === "string" && rawErr.trim()) err = rawErr;
    else if (rawErr && typeof rawErr === "object") {
      const msg = (rawErr as { message?: unknown }).message;
      err = typeof msg === "string" && msg.trim() ? msg : `HTTP ${res.status}`;
    } else err = `HTTP ${res.status}`;
    return { ok: false as const, status: res.status, error: err, data: json };
  }
  return { ok: true as const, status: res.status, data: json };
}

function normalizeMatch(raw: Record<string, unknown>, leagueName?: string): RichMatch {
  const home = (raw.home ?? {}) as Record<string, unknown>;
  const away = (raw.away ?? {}) as Record<string, unknown>;
  const eventsRaw = ((raw.events as Record<string, unknown>)?.event ?? []) as unknown;
  const events: MatchEvent[] = asArray(eventsRaw as MatchEvent).map((e) => ({
    id: String((e as Record<string, unknown>).id ?? ""),
    type: String((e as Record<string, unknown>).type ?? ""),
    team: String((e as Record<string, unknown>).team ?? "") as MatchEvent["team"],
    minute: String((e as Record<string, unknown>).minute ?? ""),
    extraMin: String((e as Record<string, unknown>).extra_min ?? "") || undefined,
    player: String((e as Record<string, unknown>).player ?? ""),
    assist: String((e as Record<string, unknown>).assist_player ?? "") || undefined,
    result: String((e as Record<string, unknown>).result ?? "") || undefined,
  }));
  const status = String(raw.status ?? "");
  const ht = raw.ht as { home_goals?: number; away_goals?: number } | null;
  const ft = raw.ft as { home_goals?: number; away_goals?: number } | null;
  return {
    matchId: String(raw.main_id ?? ""),
    status,
    minute: String(raw.inj_minute ?? "") || undefined,
    date: String(raw.date ?? ""),
    time: String(raw.time ?? ""),
    venue: String(raw.venue ?? "") || undefined,
    league: leagueName,
    home: {
      id: String(home.id ?? ""),
      name: String(home.name ?? ""),
      goals: toInt(home.goals),
    },
    away: {
      id: String(away.id ?? ""),
      name: String(away.name ?? ""),
      goals: toInt(away.goals),
    },
    ht: ht && ht.home_goals != null ? { home: ht.home_goals!, away: ht.away_goals! } : null,
    ft: ft && ft.home_goals != null ? { home: ft.home_goals!, away: ft.away_goals! } : null,
    events,
    hasLiveStats: String(raw.has_live_stats ?? "").toLowerCase() === "true",
    finished: /^(ft|aet|pen|ended|finish)/i.test(status),
  };
}

function findMatch(payload: unknown, team1: string, team2: string): RichMatch | null {
  const root = (payload as Record<string, unknown>)?.live_matches as Record<string, unknown> | undefined;
  if (!root) return null;
  const leagues = asArray(root.league as unknown) as Record<string, unknown>[];
  for (const lg of leagues) {
    const matches = asArray(lg.match as unknown) as Record<string, unknown>[];
    for (const m of matches) {
      const home = (m.home as { name?: string })?.name ?? "";
      const away = (m.away as { name?: string })?.name ?? "";
      const direct = nameMatch(home, team1) && nameMatch(away, team2);
      const swap = nameMatch(home, team2) && nameMatch(away, team1);
      if (direct || swap) return normalizeMatch(m, String(lg.name ?? ""));
    }
  }
  return null;
}

function normalizePrediction(data: unknown): MatchPrediction | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  // Statpal predictions may nest under 'prediction' or 'predictions'
  const p = (d.prediction ?? d.predictions ?? d) as Record<string, unknown>;
  const percent = (v: unknown): number | undefined => {
    if (v == null) return undefined;
    const n = typeof v === "number" ? v : Number(String(v).replace("%", ""));
    if (!Number.isFinite(n)) return undefined;
    return n > 1 ? n / 100 : n;
  };
  const homeWin = percent(p.home_win ?? p.homeWin ?? p.home);
  const draw = percent(p.draw ?? p.tie);
  const awayWin = percent(p.away_win ?? p.awayWin ?? p.away);
  if (homeWin == null && draw == null && awayWin == null) {
    return { advice: typeof p.advice === "string" ? p.advice : undefined };
  }
  return {
    homeWin,
    draw,
    awayWin,
    advice: typeof p.advice === "string" ? p.advice : undefined,
    
  };
}

function findLiveOdds(payload: unknown, matchId: string): LiveOdds[] {
  if (!payload || typeof payload !== "object") return [];
  const arr = ((payload as Record<string, unknown>).live_matches ?? []) as unknown[];
  if (!Array.isArray(arr)) return [];
  const target = arr.find((m) => {
    const info = (m as Record<string, unknown>)?.match_info as Record<string, unknown> | undefined;
    return info && String(info.main_id ?? "") === matchId;
  }) as Record<string, unknown> | undefined;
  if (!target) return [];
  const out: LiveOdds[] = [];
  const walk = (node: unknown, market: string) => {
    if (!node) return;
    if (Array.isArray(node)) {
      node.forEach((n) => walk(n, market));
      return;
    }
    if (typeof node !== "object") return;
    const rec = node as Record<string, unknown>;
    const marketName = String(rec.name ?? rec.market ?? market ?? "");
    const oddVal = rec.odd ?? rec.value ?? rec.price;
    const selection = rec.selection ?? rec.type ?? rec.outcome ?? rec.title;
    const n = typeof oddVal === "number" ? oddVal : Number(String(oddVal ?? ""));
    if (Number.isFinite(n) && n > 1 && selection) {
      out.push({ market: marketName || "Mercado", selection: String(selection), odd: n });
    }
    for (const [k, v] of Object.entries(rec)) {
      if (typeof v === "object" && v) walk(v, marketName || k);
    }
  };
  walk(target, "");
  // dedupe
  const seen = new Set<string>();
  return out.filter((o) => {
    const k = `${o.market}|${o.selection}|${o.odd}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, 40);
}

// -------- server function --------

export const getMatchRichData = createServerFn({ method: "POST" })
  .inputValidator((input: { team1: string; team2: string }) => input)
  .handler(async ({ data }): Promise<RichMatchResponse> => {
    try {
      const live = await statpalGet("matches/live");
      if (!live.ok) return { ok: false, error: live.error };
      const match = findMatch(live.data, data.team1, data.team2);
      if (!match) return { ok: false, error: "Jogo não encontrado no feed ao vivo." };

      // Try predictions and odds in parallel; both may fail on lower tiers.
      const [predRes, oddsRes] = await Promise.allSettled([
        statpalGet("predictions", { match_id: match.matchId }),
        statpalGet("odds/live"),
      ]);

      let prediction: MatchPrediction | null = null;
      if (predRes.status === "fulfilled" && predRes.value.ok) {
        prediction = normalizePrediction(predRes.value.data);
      }

      let odds: LiveOdds[] | null = null;
      if (oddsRes.status === "fulfilled" && oddsRes.value.ok) {
        const list = findLiveOdds(oddsRes.value.data, match.matchId);
        odds = list.length ? list : null;
      }

      return { ok: true, match, prediction, odds };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Falha ao consultar Statpal" };
    }
  });
