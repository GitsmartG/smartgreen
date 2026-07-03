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
      error: error.message || "Falha ao chamar bet-tips",
      triedIds: [],
    };
  }
  return data as BetTipsResult;
}
