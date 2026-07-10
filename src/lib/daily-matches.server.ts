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
  timeZone?: string;
  leagues: NormalizedLeague[];
  totalMatches: number;
};

const BR_TIME_ZONE = "America/Sao_Paulo";
const MATCH_FINISHED_AFTER_MS = 2 * 60 * 60 * 1000;

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

function isoFromStatpalDate(value?: string): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  const dmy = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return null;
}

function addDaysISO(value: string, days: number): string {
  const [year = 1970, month = 1, day = 1] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function saoPauloDateParts(date: Date): { dateISO: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BR_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const pick = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    dateISO: `${pick("year")}-${pick("month")}-${pick("day")}`,
    time: `${pick("hour")}:${pick("minute")}`,
  };
}

function parseStatpalUtcDateTime(date?: string, time?: string): Date | null {
  const iso = isoFromStatpalDate(date);
  const t = (time ?? "").match(/^(\d{1,2}):(\d{2})/);
  if (!iso || !t) return null;
  const [year = 1970, month = 1, day = 1] = iso.split("-").map(Number);
  const hour = Number(t[1]);
  const minute = Number(t[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return new Date(Date.UTC(year, month - 1, day, hour, minute));
}

function localMatchDateISO(date?: string, time?: string): string | undefined {
  const parsed = parseStatpalUtcDateTime(date, time);
  return parsed ? saoPauloDateParts(parsed).dateISO : isoFromStatpalDate(date) ?? undefined;
}

function localMatchTime(date?: string, time?: string): string | undefined {
  const parsed = parseStatpalUtcDateTime(date, time);
  if (parsed) return saoPauloDateParts(parsed).time;
  const t = (time ?? "").match(/^(\d{1,2}):(\d{2})/);
  return t ? `${t[1].padStart(2, "0")}:${t[2]}` : time;
}

function deriveLifecycle(status: string, date?: string, time?: string): {
  status: string;
  finished: boolean;
  live: boolean;
} {
  if (isFinished(status)) return { status, finished: true, live: false };
  if (isLive(status)) return { status, finished: false, live: true };

  const kickoff = parseStatpalUtcDateTime(date, time);
  if (kickoff) {
    const elapsed = Date.now() - kickoff.getTime();
    if (elapsed >= MATCH_FINISHED_AFTER_MS) return { status: "FINISHED", finished: true, live: false };
    if (elapsed >= 0) return { status: "LIVE", finished: false, live: true };
  }

  return { status, finished: false, live: false };
}

function statpalDateFromISO(value: string): string {
  const [year = "1970", month = "01", day = "01"] = value.split("-");
  return `${day.padStart(2, "0")}.${month.padStart(2, "0")}.${year}`;
}

function dateDiffDays(aISO: string, bISO: string): number {
  const [ay, am, ad] = aISO.split("-").map(Number);
  const [by, bm, bd] = bISO.split("-").map(Number);
  const a = Date.UTC(ay, (am || 1) - 1, ad || 1);
  const b = Date.UTC(by, (bm || 1) - 1, bd || 1);
  return Math.round((a - b) / 86_400_000);
}

function utcTodayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function extractStatpalRoot(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object") return {};
  const obj = raw as Record<string, unknown>;
  if (obj.live_matches && typeof obj.live_matches === "object") {
    return obj.live_matches as Record<string, unknown>;
  }
  for (const [key, value] of Object.entries(obj)) {
    if (/^matches_\d{2}_\d{2}_\d{4}$/.test(key) && value && typeof value === "object") {
      return value as Record<string, unknown>;
    }
  }
  if ("league" in obj) return obj;
  return {};
}

function filterPayloadByDate(payload: DailyMatchesPayload, dateISO: string): DailyMatchesPayload {
  const leagues = (Array.isArray(payload.leagues) ? payload.leagues : [])
    .map((lg) => ({
      ...lg,
      matches: (Array.isArray(lg.matches) ? lg.matches : []).filter((m) => isoFromStatpalDate(m.date) === dateISO),
    }))
    .filter((lg) => lg.matches.length > 0);
  return {
    ...payload,
    leagues,
    totalMatches: leagues.reduce((sum, lg) => sum + lg.matches.length, 0),
  };
}

function payloadHasOnlyDate(payload: DailyMatchesPayload, dateISO: string): boolean {
  for (const lg of Array.isArray(payload.leagues) ? payload.leagues : []) {
    for (const m of Array.isArray(lg.matches) ? lg.matches : []) {
      if (isoFromStatpalDate(m.date) !== dateISO) return false;
    }
  }
  return true;
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

export function normalizeStatpalLive(raw: unknown, dateISO?: string): DailyMatchesPayload {
  const root = extractStatpalRoot(raw);
  const leaguesRaw = ensureArray<Record<string, unknown>>(root.league);
  const leagues: NormalizedLeague[] = [];
  let total = 0;

  for (const lg of leaguesRaw) {
    const matchesRaw = ensureArray<Record<string, unknown>>(lg.match);
    const matches: NormalizedMatch[] = matchesRaw.map((m) => {
      const home = (m.home as Record<string, unknown>) ?? {};
      const away = (m.away as Record<string, unknown>) ?? {};
      const status = String(m.status ?? "");
      const rawDate = typeof m.date === "string" ? m.date : undefined;
      const rawTime =
        typeof m.time === "string"
          ? m.time
          : /^\d{1,2}:\d{2}/.test(status)
            ? status
            : undefined;
      const lifecycle = deriveLifecycle(status, rawDate, rawTime);
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
        status: lifecycle.status,
        time: localMatchTime(rawDate, rawTime),
        date: localMatchDateISO(rawDate, rawTime),
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
        finished: lifecycle.finished,
        live: lifecycle.live,
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

  const payload = {
    updated: typeof root.updated === "string" ? root.updated : undefined,
    updatedTs: toNum(root.updated_ts) ?? undefined,
    timeZone: BR_TIME_ZONE,
    leagues,
    totalMatches: total,
  };

  return dateISO ? filterPayloadByDate(payload, dateISO) : payload;
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

async function statpalFetchDaily(offset: number): Promise<unknown> {
  const key = process.env.STATPAL_API_KEY;
  if (!key) throw new Error("STATPAL_API_KEY não configurada");
  const res = await fetch(
    `https://statpal.io/api/v2/soccer/matches/daily?access_key=${encodeURIComponent(key)}&offset=${offset}`,
    { headers: { Accept: "application/json" } },
  );
  if (!res.ok) throw new Error(`Statpal daily HTTP ${res.status}`);
  return await res.json();
}

async function fetchMatchesPayloadForDate(dateISO: string): Promise<DailyMatchesPayload> {
  const utcBase = utcTodayISO();
  const offsets = Array.from(
    new Set([
      dateDiffDays(dateISO, utcBase),
      // O dia de Brasília entre 21h e 23h59 cai no dia seguinte do calendário UTC da API.
      dateDiffDays(addDaysISO(dateISO, 1), utcBase),
    ]),
  );

  // Endpoint /daily traz a agenda completa (agendados + ao vivo + encerrados).
  // O /live só devolve partidas rolando agora. Pra "hoje" (offset 0 UTC) precisamos
  // dos dois: daily como base e live pra atualizar placar/status em tempo real.
  const dailyPayloads: DailyMatchesPayload[] = [];
  for (const offset of offsets) {
    if (offset >= -7 && offset <= 7) {
      dailyPayloads.push(normalizeStatpalLive(await statpalFetchDaily(offset), dateISO));
    }
  }

  if (dailyPayloads.length > 0) {
    const daily = dailyPayloads.reduce<DailyMatchesPayload | undefined>(
      (acc, payload) => mergeLivePayload(acc, payload),
      undefined,
    ) ?? { leagues: [], totalMatches: 0 };
    try {
      const live = normalizeStatpalLive(await statpalFetchLive(), dateISO);
      return mergeLivePayload(daily, live);
    } catch {
      return daily;
    }
  }

  return normalizeStatpalLive(await statpalFetchLive(), dateISO);
}

export async function fetchLiveMatchesPayload(date?: string): Promise<DailyMatchesPayload> {
  return normalizeStatpalLive(await statpalFetchLive(), date ?? todayISO());
}

export function mergeLivePayload(
  base: DailyMatchesPayload | undefined,
  live: DailyMatchesPayload,
): DailyMatchesPayload {
  if (!base) return live;
  const leagues = (Array.isArray(base.leagues) ? base.leagues : []).map((lg) => ({
    ...lg,
    matches: [...(Array.isArray(lg.matches) ? lg.matches : [])],
  }));
  const leagueById = new Map(leagues.map((lg) => [lg.id, lg]));
  const matchById = new Map<string, { leagueIndex: number; matchIndex: number }>();
  const matchByTeams = new Map<string, { leagueIndex: number; matchIndex: number }>();

  leagues.forEach((lg, leagueIndex) => {
    (Array.isArray(lg.matches) ? lg.matches : []).forEach((m, matchIndex) => {
      matchById.set(m.id, { leagueIndex, matchIndex });
      for (const alt of m.alternateIds ?? []) matchById.set(alt, { leagueIndex, matchIndex });
      matchByTeams.set(matchKey(m.home.name, m.away.name), { leagueIndex, matchIndex });
    });
  });

  for (const liveLeague of Array.isArray(live.leagues) ? live.leagues : []) {
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

    for (const liveMatch of Array.isArray(liveLeague.matches) ? liveLeague.matches : []) {
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
    timeZone: BR_TIME_ZONE,
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
  return saoPauloDateParts(new Date()).dateISO;
}

// Datas passadas nunca devem ter jogos "ao vivo". Cache salvo enquanto o jogo
// rolava mantém status "1H"/"2H"/"LIVE" — normaliza tudo pra encerrado.
function finalizePastPayload(payload: DailyMatchesPayload): DailyMatchesPayload {
  const leagues = (payload.leagues ?? []).map((lg) => ({
    ...lg,
    matches: (lg.matches ?? []).map((m) => {
      if (!m.live && m.finished) return m;
      const isFinal = m.finished || isFinished(String(m.status ?? ""));
      return {
        ...m,
        live: false,
        finished: true,
        status: isFinal ? m.status : "FT",
      };
    }),
  }));
  return { ...payload, leagues };
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
  let payload = data.payload as DailyMatchesPayload;
  if (payload?.timeZone !== BR_TIME_ZONE) return null;
  // Invalida cache antigo que ainda não tem logo/id dos times
  const first = payload?.leagues?.[0]?.matches?.[0];
  // Invalida cache antigo salvo com data/horário crus da API em UTC.
  if (first?.date && !/^\d{4}-\d{2}-\d{2}$/.test(first.date)) return null;
  if (first && !first.home?.image && !first.home?.id) return null;
  // Invalida cache antigo que marcava horário (ex: "23:00") como jogo ao vivo.
  if (cacheShapeIsStale(payload)) return null;
  // Invalida cache antigo vindo do endpoint live sem filtro, que misturava ontem/amanhã.
  if (!payloadHasOnlyDate(payload, String(data.match_date))) return null;
  // Datas passadas: força tudo pra encerrado (cache pode ter sido salvo com jogos ao vivo).
  if (dateDiffDays(String(data.match_date), todayISO()) < 0) {
    payload = finalizePastPayload(payload);
  }
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
  let payload = await fetchMatchesPayloadForDate(d);
  if (dateDiffDays(d, todayISO()) < 0) {
    payload = finalizePastPayload(payload);
  }
  try {
    const client = getAdminClient();
    await client
      .from("daily_matches")
      .upsert(
        { match_date: d, payload, fetched_at: new Date().toISOString(), source: "statpal" },
        { onConflict: "match_date" },
      );
  } catch {
    // A listagem não deve quebrar só porque a gravação de cache falhou.
  }
  return { date: d, payload };
}
