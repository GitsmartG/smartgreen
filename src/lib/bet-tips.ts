import { supabase } from "@/integrations/supabase/client";

export type Parceiro = "seubet" | "h2bet";

export interface BetTipsMatch {
  sport: string;
  region: string;
  competition: string;
  event: string;
  team1: string;
  team2: string;
  betId: string;
  gameId?: string;
  gameNumber?: number | null;
  startMs?: number | null;
}

export type BetTipsResult =
  | {
      ok: true;
      parceiro: Parceiro;
      match: BetTipsMatch;
      matchedBy: "id" | "game_number" | "url";
      matchedValue: string;
      market: string | null;
      odd: number | null;
      titulo_sugerido: string;
      htmlOk: boolean;
    }
  | {
      ok: false;
      parceiro: Parceiro;
      error: string;
      triedIds: string[];
      sharedMeta?: {
        betId: string;
        fixedType: string | null;
        odd: number | null;
        amount: number | null;
        possibleWin: number | null;
        dateMs: number | null;
        isLive: boolean | null;
        outcome: number | null;
      };
    };

export async function importBetTip(
  parceiro: Parceiro,
  url: string,
): Promise<BetTipsResult> {
  const { data, error } = await supabase.functions.invoke("bet-tips", {
    body: { parceiro, url },
  });
  if (error) {
    return {
      ok: false,
      parceiro,
      error: normalizeMessage(error.message || "Falha ao chamar bet-tips"),
      triedIds: [],
    };
  }
  if (!data || typeof data !== "object") {
    return {
      ok: false,
      parceiro,
      error: "Resposta inválida da busca de aposta.",
      triedIds: [],
    };
  }

  const result = data as BetTipsResult;
  if (!result.ok) {
    return {
      ...result,
      error: normalizeMessage(result.error),
      triedIds: Array.isArray(result.triedIds) ? result.triedIds.map(String) : [],
    };
  }
  return result;
}

function normalizeMessage(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Error) return value.message;
  if (value == null) return "Erro ao buscar no feed.";
  try {
    const text = JSON.stringify(value);
    return text && text !== "{}" ? text : "Erro ao buscar no feed.";
  } catch {
    return "Erro ao buscar no feed.";
  }
}
