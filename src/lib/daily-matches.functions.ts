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
      // Cache stale ou inexistente → busca agora
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
        // Se o refresh falhar mas tem cache antigo, devolve o antigo
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
