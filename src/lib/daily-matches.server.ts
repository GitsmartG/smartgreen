import { createClient } from "@supabase/supabase-js";

export type NormalizedMatch = {
  id: string;
  status: string;
  time?: string;
  date?: string;
  venue?: string;
  home: { name: string; goals: number | null; id?: string };
  away: { name: string; goals: number | null; id?: string };
  finished: boolean;
  live: boolean;
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
  return /^(HT|1H|2H|ET|BREAK|LIVE|\d+)/.test(s);
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
      return {
        id: String(m.main_id ?? m.fallback_id_1 ?? crypto.randomUUID()),
        status,
        time: typeof m.time === "string" ? m.time : undefined,
        date: typeof m.date === "string" ? m.date : undefined,
        venue: typeof m.venue === "string" ? m.venue : undefined,
        home: {
          name: String(home.name ?? "?"),
          goals: toNum(home.goals),
          id: home.id != null ? String(home.id) : undefined,
        },
        away: {
          name: String(away.name ?? "?"),
          goals: toNum(away.goals),
          id: away.id != null ? String(away.id) : undefined,
        },
        finished: isFinished(status),
        live: isLive(status),
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
  // usa UTC pra bater com pg_cron sem depender de TZ do server
  return new Date().toISOString().slice(0, 10);
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
  return {
    date: String(data.match_date),
    payload: data.payload as DailyMatchesPayload,
    fetchedAt: String(data.fetched_at),
  };
}

export async function refreshDailyMatches(date?: string): Promise<{
  date: string;
  payload: DailyMatchesPayload;
}> {
  const d = date ?? todayISO();
  const raw = await statpalFetchLive();
  const payload = normalizeStatpalLive(raw);
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
