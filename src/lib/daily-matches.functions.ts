import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import type { DailyMatchesPayload } from "./daily-matches.server";

export type DailyMatchesResult = {
  ok: boolean;
  error?: string;
  date?: string;
  fetchedAt?: string;
  cached: boolean;
  payload?: DailyMatchesPayload;
};

export const getLiveMatches = createServerFn({ method: "POST" })
  .inputValidator((input: { nonce?: number } | undefined) => input ?? {})
  .handler(
    async (): Promise<DailyMatchesResult> => {
      const { fetchLiveMatchesPayload } = await import("./daily-matches.server");
      try {
        setResponseHeader("Cache-Control", "no-store, max-age=0");
        return {
          ok: true,
          cached: false,
          fetchedAt: new Date().toISOString(),
          payload: await fetchLiveMatchesPayload(),
        };
      } catch (e) {
        return {
          ok: false,
          cached: false,
          error: e instanceof Error ? e.message : "Erro ao buscar jogos ao vivo",
        };
      }
    },
  );

export const getTodayMatches = createServerFn({ method: "GET" }).handler(
  async (): Promise<DailyMatchesResult> => {
    const { readCachedDaily, refreshDailyMatches } = await import("./daily-matches.server");
    try {
      const cached = await readCachedDaily();
      const CACHE_TTL_MS = 60_000; // 1 min
      const isFresh =
        cached &&
        Date.now() - new Date(cached.fetchedAt).getTime() < CACHE_TTL_MS;
      if (cached && isFresh) {
        return {
          ok: true,
          cached: true,
          date: cached.date,
          fetchedAt: cached.fetchedAt,
          payload: cached.payload,
        };
      }
      try {
        const fresh = await refreshDailyMatches();
        return {
          ok: true,
          cached: false,
          date: fresh.date,
          fetchedAt: new Date().toISOString(),
          payload: fresh.payload,
        };
      } catch (refreshErr) {
        if (cached) {
          return {
            ok: true,
            cached: true,
            date: cached.date,
            fetchedAt: cached.fetchedAt,
            payload: cached.payload,
          };
        }
        throw refreshErr;
      }
    } catch (e) {
      return {
        ok: false,
        cached: false,
        error: e instanceof Error ? e.message : "Erro ao buscar jogos do dia",
      };
    }
  },
);

const BR_TZ = "America/Sao_Paulo";
function brTodayISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BR_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
function diffDaysFromToday(iso: string): number {
  const today = brTodayISO();
  const [ty, tm, td] = today.split("-").map(Number);
  const [gy, gm, gd] = iso.split("-").map(Number);
  return Math.round(
    (Date.UTC(gy, gm - 1, gd) - Date.UTC(ty, tm - 1, td)) / 86_400_000,
  );
}

function addDaysISOFn(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export const getMatchesByDate = createServerFn({ method: "POST" })
  .inputValidator((input: { date?: string } | undefined) => {
    const raw = (input?.date ?? "").toString().trim().toLowerCase();
    let date = raw;
    if (raw === "" || raw === "today" || raw === "hoje") date = brTodayISO();
    else if (raw === "yesterday" || raw === "ontem") date = addDaysISOFn(brTodayISO(), -1);
    else if (raw === "tomorrow" || raw === "amanha" || raw === "amanhã") date = addDaysISOFn(brTodayISO(), 1);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error("Data inválida (use YYYY-MM-DD)");
    }
    return { date };
  })
  .handler(async (ctx): Promise<DailyMatchesResult> => {
    const { readCachedDaily, refreshDailyMatches } = await import("./daily-matches.server");
    const handlerToday = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const data = ctx?.data ?? { date: brTodayISO() };
    const [ty, tm, td] = handlerToday.split("-").map(Number);
    const [gy, gm, gd] = data.date.split("-").map(Number);
    const offset = Math.round(
      (Date.UTC(gy, gm - 1, gd) - Date.UTC(ty, tm - 1, td)) / 86_400_000,
    );

    if (Math.abs(offset) > 7) {
      return { ok: false, cached: false, error: "Data fora do range (±7 dias)." };
    }
    try {
      const cached = await readCachedDaily(data.date);
      const CACHE_TTL_MS = 60_000;
      // Datas passadas: usa cache permanentemente. Hoje/futuro: TTL 60s.
      const isFresh =
        cached && (offset < 0 || Date.now() - new Date(cached.fetchedAt).getTime() < CACHE_TTL_MS);
      if (cached && isFresh) {
        return {
          ok: true,
          cached: true,
          date: cached.date,
          fetchedAt: cached.fetchedAt,
          payload: cached.payload,
        };
      }
      try {
        const fresh = await refreshDailyMatches(data.date);
        return {
          ok: true,
          cached: false,
          date: fresh.date,
          fetchedAt: new Date().toISOString(),
          payload: fresh.payload,
        };
      } catch (refreshErr) {
        if (cached) {
          return {
            ok: true,
            cached: true,
            date: cached.date,
            fetchedAt: cached.fetchedAt,
            payload: cached.payload,
          };
        }
        throw refreshErr;
      }
    } catch (e) {
      return {
        ok: false,
        cached: false,
        error: e instanceof Error ? e.message : "Erro ao buscar jogos",
      };
    }
  });

