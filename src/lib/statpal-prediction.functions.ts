import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Fallback local: substitui termos comuns pra PT-BR quando a AI falha.
const LOCAL_MAP: [RegExp, string][] = [
  [/\bmatch\s+winner\b/gi, "Vencedor da Partida"],
  [/\bboth\s+teams\s+to\s+score\b/gi, "Ambas Marcam"],
  [/\bcorrect\s+score\b/gi, "Placar Exato"],
  [/\bdouble\s+chance\b/gi, "Dupla Chance"],
  [/\btotal\s+goals\b/gi, "Total de Gols"],
  [/\basian\s+handicap\b/gi, "Handicap Asiático"],
  [/\bhandicap\b/gi, "Handicap"],
  [/\bclean\s+sheet\b/gi, "Não Sofrer Gol"],
  [/\bfirst\s+half\b/gi, "Primeiro Tempo"],
  [/\bsecond\s+half\b/gi, "Segundo Tempo"],
  [/\bfull\s*time\b/gi, "Tempo Integral"],
  [/\bhalf\s*time\b/gi, "Intervalo"],
  [/\bhome\s+win\b/gi, "Vitória do Mandante"],
  [/\baway\s+win\b/gi, "Vitória do Visitante"],
  [/\bhome\s+team\b/gi, "Time da casa"],
  [/\baway\s+team\b/gi, "Time visitante"],
  [/\bover\b/gi, "Mais de"],
  [/\bunder\b/gi, "Menos de"],
  [/\bhome\b/gi, "Casa"],
  [/\baway\b/gi, "Fora"],
  [/\bdraw\b/gi, "Empate"],
  [/\bto\s+win\b/gi, "para vencer"],
  [/\bwins?\b/gi, "vitória"],
  [/\bloses?\b/gi, "derrota"],
  [/\bgoals?\b/gi, "gols"],
  [/\bshots?\b/gi, "chutes"],
  [/\bpossession\b/gi, "posse de bola"],
  [/\bform\b/gi, "forma"],
  [/\brecent\b/gi, "recente"],
  [/\bagainst\b/gi, "contra"],
  [/\bfavou?rite\b/gi, "favorito"],
  [/\bpredict(?:ion|ed|s)?\b/gi, "previsão"],
  [/\bmodel\b/gi, "modelo"],
  [/\bmarket\b/gi, "mercado"],
  [/\bselection\b/gi, "seleção"],
  [/\bodds?\b/gi, "odds"],
  [/\bstrong(?:er|est)?\b/gi, "forte"],
  [/\bweak(?:er|est)?\b/gi, "fraco"],
  [/\bhistory\b/gi, "histórico"],
  [/\bmatches?\b/gi, "partidas"],
  [/\bteams?\b/gi, "times"],
  [/\bplayers?\b/gi, "jogadores"],
  [/\binjur(?:y|ies|ed)\b/gi, "lesão"],
  [/\bsuspended?\b/gi, "suspenso"],
  [/\bexpected?\b/gi, "esperado"],
  [/\blikely\b/gi, "provável"],
  [/\bunlikely\b/gi, "improvável"],
  [/\bbased on\b/gi, "com base em"],
];
function localTranslate(s?: string): string | undefined {
  if (!s) return s;
  let out = s;
  for (const [re, val] of LOCAL_MAP) out = out.replace(re, val);
  return out.replace(/\s+/g, " ").trim();
}
function applyLocalFallback(
  p: NonNullable<PredictionResult["prediction"]>,
): NonNullable<PredictionResult["prediction"]> {
  return {
    choice: localTranslate(p.choice) ?? p.choice,
    reasoning: localTranslate(p.reasoning) ?? p.reasoning,
    prematch_odds: p.prematch_odds
      ? {
          ...p.prematch_odds,
          market: localTranslate(p.prematch_odds.market) ?? p.prematch_odds.market,
          modifier: localTranslate(p.prematch_odds.modifier) ?? p.prematch_odds.modifier,
          selection: localTranslate(p.prematch_odds.selection) ?? p.prematch_odds.selection,
        }
      : undefined,
  };
}


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
        if (res.status === 404) {
          return { ok: false, error: "Sem previsão disponível para essa partida." };
        }
        if (res.status === 429) {
          return { ok: false, error: "Limite de consultas atingido. Tenta de novo em alguns instantes." };
        }
        return { ok: false, error: "Não foi possível consultar a previsão agora." };
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
                model: "google/gemini-2.5-flash",
                messages: [
                  {
                    role: "system",
                    content:
                      "Você traduz JSON de previsões de apostas esportivas para português do Brasil. Regras:\n- Traduza TODOS os textos, incluindo 'X to win' → 'Vitória do X', 'Draw' → 'Empate'.\n- Mantenha nomes próprios (times, ligas, jogadores) em inglês.\n- Termos: 'Match Winner'/'1x2' → 'Vencedor da Partida', 'Both Teams To Score' → 'Ambas Marcam', 'Over' → 'Mais de', 'Under' → 'Menos de', 'Home' → 'Casa', 'Away' → 'Fora'.\n- Responda APENAS com JSON válido no MESMO formato de entrada, com todas as chaves preservadas mesmo se vazias.",
                  },
                  { role: "user", content: JSON.stringify(payload) },
                ],
                response_format: { type: "json_object" },
              }),
            },
          );
          clearTimeout(aiTimer);
          if (!aiRes.ok) {
            console.warn("[prediction-translate] AI HTTP", aiRes.status, await aiRes.text().catch(() => ""));
            return applyLocalFallback(p);
          }
          const aiJson = (await aiRes.json()) as {
            choices?: { message?: { content?: string } }[];
          };
          const content = aiJson.choices?.[0]?.message?.content;
          if (!content) return applyLocalFallback(p);
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
        } catch (err) {
          console.warn("[prediction-translate] falhou:", err);
          return applyLocalFallback(p);
        }
      };
      const prediction = json.prediction
        ? await translatePrediction(applyLocalFallback(json.prediction))
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
