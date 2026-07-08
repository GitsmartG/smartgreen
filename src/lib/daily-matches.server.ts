import { createClient } from "@supabase/supabase-js";

export type NormalizedMatch = {
  id: string;
  alternateIds?: string[];
  status: string;
  time?: string;
  date?: string;
  venue?: string;
  home: { name: string; goals: number | null; id?: string; image?: string };
  away: { name: string; goals: number | null; id?: string; image?: string };
  finished: boolean;
  live: boolean;
  events?: NormalizedMatchEvent[];
  hasLiveStats?: boolean;
};

export type NormalizedMatchEvent = {
  id: string;
  type: string;
  team: "home" | "away" | string;
  minute: string;
  extraMin?: string;
  player?: string;
  assist?: string;
  result?: string;
};

export type NormalizedLeague = {
  id: string;
  name: string;
  country: string;
  matches: NormalizedMatch[];
};

export type DailyMatchesPayload = {
  updated?: string;
  updatedTs?: number;
  leagues: NormalizedLeague[];
  totalMatches: number;
};

function isFinished(status: string): boolean {
  const s = status.toUpperCase();
  return s === "FT" || s === "AET" || s === "PEN" || s === "AWARDED" || s === "FINISHED";
}
function isLive(status: string): boolean {
  const s = status.toUpperCase();
  if (isFinished(s)) return false;
  if (/^\d{1,2}:\d{2}$/.test(s)) return false;
  return /^(HT|1H|2H|ET|BREAK|LIVE|INPLAY)$/.test(s) || /^\d{1,3}(?:\+\d+)?'?$/.test(s);
}

function cacheShapeIsStale(payload: DailyMatchesPayload): boolean {
  return (payload?.leagues ?? []).some((lg) =>
    (lg.matches ?? []).some((m) => {
      const status = String(m.status ?? "");
      return !!m.live && /^\d{1,2}:\d{2}$/.test(status);
    }),
  );
}

function toNum(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function ensureArray<T>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[];
  if (v == null) return [];
  return [v as T];
}

function normalizeEvent(raw: unknown): NormalizedMatchEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as Record<string, unknown>;
  const id = String(e.id ?? `${e.type ?? "event"}-${e.team ?? ""}-${e.minute ?? ""}-${e.player ?? ""}`);
  return {
    id,
    type: String(e.type ?? "").toLowerCase(),
    team: String(e.team ?? ""),
    minute: String(e.minute ?? ""),
    extraMin: String(e.extra_min ?? "") || undefined,
    player: String(e.player ?? "") || undefined,
    assist: String(e.assist_player ?? "") || undefined,
    result: String(e.result ?? "") || undefined,
  };
}

function matchKey(home?: string, away?: string): string {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  return `${norm(home ?? "")}::${norm(away ?? "")}`;
}

function mergeMatch(base: NormalizedMatch, live: NormalizedMatch): NormalizedMatch {
  return {
    ...base,
    ...live,
    home: {
      ...base.home,
      ...live.home,
      image: live.home.image ?? base.home.image,
      id: live.home.id ?? base.home.id,
    },
    away: {
      ...base.away,
      ...live.away,
      image: live.away.image ?? base.away.image,
      id: live.away.id ?? base.away.id,
    },
  };
}

export function normalizeStatpalLive(raw: unknown): DailyMatchesPayload {
  const root =
    raw && typeof raw === "object" && "live_matches" in raw
      ? (raw as { live_matches?: Record<string, unknown> }).live_matches ?? {}
      : {};
  const leaguesRaw = ensureArray<Record<string, unknown>>(root.league);
  const leagues: NormalizedLeague[] = [];
  let total = 0;

  for (const lg of leaguesRaw) {
    const matchesRaw = ensureArray<Record<string, unknown>>(lg.match);
    const matches: NormalizedMatch[] = matchesRaw.map((m) => {
      const home = (m.home as Record<string, unknown>) ?? {};
      const away = (m.away as Record<string, unknown>) ?? {};
      const status = String(m.status ?? "");
      const events = ensureArray((m.events as Record<string, unknown> | undefined)?.event)
        .map(normalizeEvent)
        .filter((event): event is NormalizedMatchEvent => event != null);
      const pickStr = (o: Record<string, unknown>, ...keys: string[]): string | undefined => {
        for (const k of keys) {
          const v = o[k];
          if (typeof v === "string" && v.trim()) return v;
        }
        return undefined;
      };
      return {
        id: String(m.main_id ?? m.fallback_id_1 ?? crypto.randomUUID()),
        alternateIds: [m.main_id, m.fallback_id_1, m.fallback_id_2, m.fallback_id_3]
          .map((v) => (v == null ? "" : String(v)))
          .filter(Boolean),
        status,
        time: typeof m.time === "string" ? m.time : undefined,
        date: typeof m.date === "string" ? m.date : undefined,
        venue: typeof m.venue === "string" ? m.venue : undefined,
        home: {
          name: String(home.name ?? "?"),
          goals: toNum(home.goals),
          id: pickStr(home, "id", "team_id"),
          image: pickStr(home, "image", "logo", "crest", "badge"),
        },
        away: {
          name: String(away.name ?? "?"),
          goals: toNum(away.goals),
          id: pickStr(away, "id", "team_id"),
          image: pickStr(away, "image", "logo", "crest", "badge"),
        },
        finished: isFinished(status),
        live: isLive(status),
        events,
        hasLiveStats: String(m.has_live_stats ?? "").toLowerCase() === "true",
      };
    });
    total += matches.length;
    leagues.push({
      id: String(lg.id ?? ""),
      name: String(lg.name ?? "Liga"),
      country: String(lg.country ?? "").toLowerCase(),
      matches,
    });
  }

  return {
    updated: typeof root.updated === "string" ? root.updated : undefined,
    updatedTs: toNum(root.updated_ts) ?? undefined,
    leagues,
    totalMatches: total,
  };
}

async function statpalFetchLive(): Promise<unknown> {
  const key = process.env.STATPAL_API_KEY;
  if (!key) throw new Error("STATPAL_API_KEY não configurada");
  const res = await fetch(
    `https://statpal.io/api/v2/soccer/matches/live?access_key=${encodeURIComponent(key)}`,
    { headers: { Accept: "application/json" } },
  );
  if (!res.ok) throw new Error(`Statpal HTTP ${res.status}`);
  return await res.json();
}

export async function fetchLiveMatchesPayload(): Promise<DailyMatchesPayload> {
  return normalizeStatpalLive(await statpalFetchLive());
}

export function mergeLivePayload(
  base: DailyMatchesPayload | undefined,
  live: DailyMatchesPayload,
): DailyMatchesPayload {
  if (!base) return live;
  const leagues = base.leagues.map((lg) => ({ ...lg, matches: [...(lg.matches ?? [])] }));
  const leagueById = new Map(leagues.map((lg) => [lg.id, lg]));
  const matchById = new Map<string, { leagueIndex: number; matchIndex: number }>();
  const matchByTeams = new Map<string, { leagueIndex: number; matchIndex: number }>();

  leagues.forEach((lg, leagueIndex) => {
    lg.matches.forEach((m, matchIndex) => {
      matchById.set(m.id, { leagueIndex, matchIndex });
      for (const alt of m.alternateIds ?? []) matchById.set(alt, { leagueIndex, matchIndex });
      matchByTeams.set(matchKey(m.home.name, m.away.name), { leagueIndex, matchIndex });
    });
  });

  for (const liveLeague of live.leagues) {
    let targetLeague = liveLeague.id ? leagueById.get(liveLeague.id) : undefined;
    if (!targetLeague) {
      const byName = leagues.find(
        (lg) => matchKey(lg.name, lg.country) === matchKey(liveLeague.name, liveLeague.country),
      );
      targetLeague = byName;
    }
    if (!targetLeague) {
      targetLeague = { ...liveLeague, matches: [] };
      leagues.push(targetLeague);
      if (targetLeague.id) leagueById.set(targetLeague.id, targetLeague);
    }

    for (const liveMatch of liveLeague.matches ?? []) {
      const found =
        matchById.get(liveMatch.id) ||
        (liveMatch.alternateIds ?? []).map((id) => matchById.get(id)).find(Boolean) ||
        matchByTeams.get(matchKey(liveMatch.home.name, liveMatch.away.name));
      if (found) {
        const existing = leagues[found.leagueIndex].matches[found.matchIndex];
        leagues[found.leagueIndex].matches[found.matchIndex] = mergeMatch(existing, liveMatch);
      } else {
        targetLeague.matches.push(liveMatch);
        const leagueIndex = leagues.indexOf(targetLeague);
        const matchIndex = targetLeague.matches.length - 1;
        matchById.set(liveMatch.id, { leagueIndex, matchIndex });
        for (const alt of liveMatch.alternateIds ?? []) matchById.set(alt, { leagueIndex, matchIndex });
        matchByTeams.set(matchKey(liveMatch.home.name, liveMatch.away.name), { leagueIndex, matchIndex });
      }
    }
  }

  return {
    updated: live.updated ?? base.updated,
    updatedTs: live.updatedTs ?? base.updatedTs,
    leagues,
    totalMatches: leagues.reduce((sum, lg) => sum + (lg.matches?.length ?? 0), 0),
  };
}

function getAdminClient() {
  const url = process.env.SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !serviceKey) throw new Error("Supabase env vars ausentes");
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function todayISO(): string {
  // Data "hoje" no fuso America/Sao_Paulo (UTC-3), pra bater com a percepção do usuário BR.
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${d}`;
}


export async function readCachedDaily(date?: string): Promise<{
  date: string;
  payload: DailyMatchesPayload;
  fetchedAt: string;
} | null> {
  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !anon) return null;
  const client = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const d = date ?? todayISO();
  const { data, error } = await client
    .from("daily_matches")
    .select("match_date, payload, fetched_at")
    .eq("match_date", d)
    .maybeSingle();
  if (error || !data) return null;
  const payload = data.payload as DailyMatchesPayload;
  // Invalida cache antigo que ainda não tem logo/id dos times
  const first = payload?.leagues?.[0]?.matches?.[0];
  if (first && !first.home?.image && !first.home?.id) return null;
  // Invalida cache antigo que marcava horário (ex: "23:00") como jogo ao vivo.
  if (cacheShapeIsStale(payload)) return null;
  return {
    date: String(data.match_date),
    payload,
    fetchedAt: String(data.fetched_at),
  };
}

export async function refreshDailyMatches(date?: string): Promise<{
  date: string;
  payload: DailyMatchesPayload;
}> {
  const d = date ?? todayISO();
  const payload = await fetchLiveMatchesPayload();
  const client = getAdminClient();
  const { error } = await client
    .from("daily_matches")
    .upsert(
      { match_date: d, payload, fetched_at: new Date().toISOString(), source: "statpal" },
      { onConflict: "match_date" },
    );
  if (error) throw new Error(`Supabase upsert falhou: ${error.message}`);
  return { date: d, payload };
}
