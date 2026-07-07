import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type PredictionResult = {
  ok: boolean;
  error?: string;
  meta?: {
    date?: string;
    time?: string;
    home_team?: { id?: string; name?: string };
    away_team?: { id?: string; name?: string };
    league?: { name?: string };
    country?: { name?: string };
    venue?: { name?: string; city?: string | null; country?: string };
  };
  prediction?: {
    choice?: string;
    reasoning?: string;
    prematch_odds?: {
      market?: string;
      modifier?: string;
      selection?: string;
      odd?: string;
    };
  };
};

export const getMatchPrediction = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ matchId: z.string().min(1) }).parse(input))
  .handler(async ({ data }): Promise<PredictionResult> => {
    const key = process.env.STATPAL_API_KEY;
    if (!key) return { ok: false, error: "STATPAL_API_KEY não configurada" };
    try {
      const url = `https://statpal.io/api/v2/soccer/predictions?access_key=${encodeURIComponent(
        key,
      )}&match_id=${encodeURIComponent(data.matchId)}`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) {
        return { ok: false, error: `HTTP ${res.status}` };
      }
      const json = (await res.json()) as PredictionResult;
      if (!json || typeof json !== "object") {
        return { ok: false, error: "Resposta inválida" };
      }
      if (!json.prediction && !json.meta) {
        return { ok: false, error: "Sem previsão disponível para essa partida" };
      }
      return { ok: true, meta: json.meta, prediction: json.prediction };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Erro ao consultar previsão" };
    }
  });
