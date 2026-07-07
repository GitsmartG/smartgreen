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
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    try {
      const url = `https://statpal.io/api/v2/soccer/predictions?access_key=${encodeURIComponent(
        key,
      )}&match_id=${encodeURIComponent(data.matchId)}`;
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      if (!res.ok) {
        return { ok: false, error: `HTTP ${res.status}` };
      }
      const json = (await res.json()) as PredictionResult & { error?: unknown };
      if (!json || typeof json !== "object") {
        return { ok: false, error: "Resposta inválida" };
      }
      if (json.error) {
        const msg =
          typeof json.error === "string"
            ? json.error
            : (json.error as { message?: string })?.message ?? "Sem previsão disponível";
        return { ok: false, error: msg };
      }
      if (!json.prediction && !json.meta) {
        return { ok: false, error: "Sem previsão disponível para essa partida" };
      }
      // Traduz os campos livres (choice/reasoning/market/selection/modifier) via
      // Lovable AI Gateway. Se falhar por qualquer motivo, retorna o original.
      const translatePrediction = async (
        p: NonNullable<PredictionResult["prediction"]>,
      ): Promise<NonNullable<PredictionResult["prediction"]>> => {
        const aiKey = process.env.LOVABLE_API_KEY;
        if (!aiKey) return p;
        const payload = {
          choice: p.choice ?? "",
          reasoning: p.reasoning ?? "",
          market: p.prematch_odds?.market ?? "",
          modifier: p.prematch_odds?.modifier ?? "",
          selection: p.prematch_odds?.selection ?? "",
        };
        if (!Object.values(payload).some((v) => v.trim())) return p;
        try {
          const aiCtrl = new AbortController();
          const aiTimer = setTimeout(() => aiCtrl.abort(), 15_000);
          const aiRes = await fetch(
            "https://ai.gateway.lovable.dev/v1/chat/completions",
            {
              method: "POST",
              headers: {
                "content-type": "application/json",
                authorization: `Bearer ${aiKey}`,
              },
              signal: aiCtrl.signal,
              body: JSON.stringify({
                model: "google/gemini-2.5-flash-lite",
                messages: [
                  {
                    role: "system",
                    content:
                      "Traduza os valores para português do Brasil, mantendo termos técnicos de apostas esportivas naturais (ex.: 'Match Winner' → 'Vencedor da Partida', 'Both Teams To Score' → 'Ambas Marcam', 'Over' → 'Mais de', 'Under' → 'Menos de', 'Home'/'Away'/'Draw' → 'Casa'/'Fora'/'Empate'). Mantenha nomes próprios de times/ligas em inglês. Responda APENAS com JSON válido no mesmo formato de entrada.",
                  },
                  { role: "user", content: JSON.stringify(payload) },
                ],
                response_format: { type: "json_object" },
              }),
            },
          );
          clearTimeout(aiTimer);
          if (!aiRes.ok) return p;
          const aiJson = (await aiRes.json()) as {
            choices?: { message?: { content?: string } }[];
          };
          const content = aiJson.choices?.[0]?.message?.content;
          if (!content) return p;
          const t = JSON.parse(content) as typeof payload;
          return {
            choice: t.choice || p.choice,
            reasoning: t.reasoning || p.reasoning,
            prematch_odds: p.prematch_odds
              ? {
                  ...p.prematch_odds,
                  market: t.market || p.prematch_odds.market,
                  modifier: t.modifier || p.prematch_odds.modifier,
                  selection: t.selection || p.prematch_odds.selection,
                }
              : undefined,
          };
        } catch {
          return p;
        }
      };
      const prediction = json.prediction
        ? await translatePrediction(json.prediction)
        : undefined;
      return { ok: true, meta: json.meta, prediction };
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        return { ok: false, error: "Tempo esgotado ao consultar previsão" };
      }
      return { ok: false, error: e instanceof Error ? e.message : "Erro ao consultar previsão" };
    } finally {
      clearTimeout(timer);
    }
  });
