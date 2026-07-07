import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type LineupPlayer = {
  id?: string;
  name?: string;
  number?: string;
  position?: string;
};

export type SidelinedPlayer = LineupPlayer & {
  status?: string;
  reason?: string | null;
};

export type TeamLineup = {
  team_id?: string;
  team_name?: string;
  coach?: { name?: string; id?: string };
  team_formation?: string;
  starting_xi?: LineupPlayer[];
  bench?: LineupPlayer[];
  sidelined?: SidelinedPlayer[];
  confidence?: number;
};

export type LineupsResult = {
  ok: boolean;
  error?: string;
  status?: string;
  updated?: string;
  home?: TeamLineup;
  away?: TeamLineup;
};

export const getMatchLineups = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ matchId: z.string().min(1) }).parse(input))
  .handler(async ({ data }): Promise<LineupsResult> => {
    const key = process.env.STATPAL_API_KEY;
    if (!key) return { ok: false, error: "STATPAL_API_KEY não configurada" };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    try {
      const url = `https://statpal.io/api/v2/soccer/team-lineups?access_key=${encodeURIComponent(
        key,
      )}&match_id=${encodeURIComponent(data.matchId)}`;
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
      const json = (await res.json()) as LineupsResult & Record<string, unknown> & { error?: unknown };
      if (!json || typeof json !== "object") {
        return { ok: false, error: "Resposta inválida" };
      }
      if (json.error) {
        const msg =
          typeof json.error === "string"
            ? json.error
            : (json.error as { message?: string })?.message ?? "Sem escalação disponível";
        return { ok: false, error: msg };
      }
      if (!json.home && !json.away) {
        return { ok: false, error: "Escalação não disponível para essa partida" };
      }
      return {
        ok: true,
        status: json.status,
        updated: json.updated,
        home: json.home,
        away: json.away,
      };
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        return { ok: false, error: "Tempo esgotado ao consultar escalação" };
      }
      return { ok: false, error: e instanceof Error ? e.message : "Erro ao consultar escalação" };
    } finally {
      clearTimeout(timer);
    }
  });
