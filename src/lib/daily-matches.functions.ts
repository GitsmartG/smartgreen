import { createServerFn } from "@tanstack/react-start";
import type { DailyMatchesPayload } from "./daily-matches.server";

export type DailyMatchesResult = {
  ok: boolean;
  error?: string;
  date?: string;
  fetchedAt?: string;
  cached: boolean;
  payload?: DailyMatchesPayload;
};

export const getTodayMatches = createServerFn({ method: "GET" }).handler(
  async (): Promise<DailyMatchesResult> => {
    const { readCachedDaily, refreshDailyMatches } = await import("./daily-matches.server");
    try {
      const cached = await readCachedDaily();
      if (cached) {
        return {
          ok: true,
          cached: true,
          date: cached.date,
          fetchedAt: cached.fetchedAt,
          payload: cached.payload,
        };
      }
      // Sem cache → busca agora e guarda
      const fresh = await refreshDailyMatches();
      return {
        ok: true,
        cached: false,
        date: fresh.date,
        fetchedAt: new Date().toISOString(),
        payload: fresh.payload,
      };
    } catch (e) {
      return {
        ok: false,
        cached: false,
        error: e instanceof Error ? e.message : "Erro ao buscar jogos do dia",
      };
    }
  },
);
