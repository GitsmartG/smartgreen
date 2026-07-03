import { createServerFn } from "@tanstack/react-start";

type FeedGame = {
  id: number;
  team1_name?: string;
  team2_name?: string;
  start_ts?: number;
  game_number?: number;
};

type Feed = {
  sport: Record<
    string,
    {
      id: number;
      name: string;
      region: Record<
        string,
        {
          alias: string;
          competition: Record<
            string,
            { id: number; name: string; game: Record<string, FeedGame> }
          >;
        }
      >;
    }
  >;
};

const FEEDS = {
  seubet:
    "https://feedodds.com/feed/json?language=por_2&timeZone=UTC&brandId=18749911&key=91c6c673e4b680e32a0cd169584f5c9a",
  h2bet:
    "https://feedodds.com/feed/json?language=por_2&timeZone=UTC&brandId=18749751&key=f3609270d523d50c90eb13de4153fd00",
} as const;

type Parceiro = keyof typeof FEEDS;

function extractBetId(url: string): number | null {
  // tenta ?bet_id= / &game_id= / último bloco numérico
  try {
    const u = new URL(url);
    const params = ["bet_id", "game_id", "id", "gameId", "betId"];
    for (const p of params) {
      const v = u.searchParams.get(p);
      if (v && /^\d+$/.test(v)) return Number(v);
    }
    const last = url.match(/(\d{6,})(?!.*\d{6,})/);
    if (last) return Number(last[1]);
  } catch {
    const m = url.match(/(\d{6,})/);
    if (m) return Number(m[1]);
  }
  return null;
}

export type FeedLookupResult =
  | {
      ok: true;
      betId: number;
      parceiro: Parceiro;
      sport: string;
      competition: string;
      region: string;
      event: string;
      team1: string;
      team2: string;
      startTs: number | null;
    }
  | { ok: false; error: string; betId: number | null };

export const lookupBetInFeed = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { url: string; parceiro: Parceiro }) => {
      if (!input || typeof input.url !== "string") throw new Error("url obrigatório");
      if (input.parceiro !== "seubet" && input.parceiro !== "h2bet")
        throw new Error("parceiro inválido");
      return input;
    },
  )
  .handler(async ({ data }): Promise<FeedLookupResult> => {
    const betId = extractBetId(data.url);
    if (!betId) return { ok: false, error: "Não achei o ID da aposta na URL.", betId: null };

    const res = await fetch(FEEDS[data.parceiro], {
      headers: { accept: "application/json" },
    });
    if (!res.ok)
      return { ok: false, error: `Feed retornou ${res.status}`, betId };

    const feed = (await res.json()) as Feed;

    for (const sport of Object.values(feed.sport ?? {})) {
      for (const region of Object.values(sport.region ?? {})) {
        for (const comp of Object.values(region.competition ?? {})) {
          for (const game of Object.values(comp.game ?? {})) {
            if (Number(game.id) === betId) {
              const team1 = game.team1_name ?? "";
              const team2 = game.team2_name ?? "";
              return {
                ok: true,
                betId,
                parceiro: data.parceiro,
                sport: sport.name,
                competition: comp.name,
                region: region.alias,
                event:
                  team1 && team2 ? `${team1} x ${team2}` : team1 || team2 || comp.name,
                team1,
                team2,
                startTs: game.start_ts ?? null,
              };
            }
          }
        }
      }
    }

    return {
      ok: false,
      error: "Aposta não encontrada no feed do parceiro.",
      betId,
    };
  });
