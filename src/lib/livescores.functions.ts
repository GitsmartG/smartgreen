import { createServerFn } from "@tanstack/react-start";
import { fetchSoccerLivescores } from "./livescores.server";

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

export const getSoccerLivescores = createServerFn({ method: "GET" }).handler(async () => {
  try {
    return await fetchSoccerLivescores();
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Falha na API", matches: [] };
  }
});
