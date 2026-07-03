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

// Cache leve por processo (5min) — evita bater feed a cada busca.
const feedCache = new Map<Parceiro, { at: number; data: Feed }>();
const CACHE_TTL = 5 * 60 * 1000;

async function getFeed(parceiro: Parceiro): Promise<Feed> {
  const c = feedCache.get(parceiro);
  if (c && Date.now() - c.at < CACHE_TTL) return c.data;
  const res = await fetch(FEEDS[parceiro], { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`Feed retornou ${res.status}`);
  const data = (await res.json()) as Feed;
  feedCache.set(parceiro, { at: Date.now(), data });
  return data;
}

function extractBetId(url: string): number | null {
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

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type Match = {
  betId: number;
  parceiro: Parceiro;
  sport: string;
  competition: string;
  region: string;
  event: string;
  team1: string;
  team2: string;
  startTs: number | null;
};

function walkFeed(feed: Feed, parceiro: Parceiro, cb: (m: Match) => void) {
  for (const sport of Object.values(feed.sport ?? {})) {
    for (const region of Object.values(sport.region ?? {})) {
      for (const comp of Object.values(region.competition ?? {})) {
        for (const game of Object.values(comp.game ?? {})) {
          const team1 = game.team1_name ?? "";
          const team2 = game.team2_name ?? "";
          cb({
            betId: Number(game.id),
            parceiro,
            sport: sport.name,
            competition: comp.name,
            region: region.alias,
            event: team1 && team2 ? `${team1} x ${team2}` : team1 || team2 || comp.name,
            team1,
            team2,
            startTs: game.start_ts ?? null,
          });
        }
      }
    }
  }
}

export type FeedLookupResult =
  | { ok: true; kind: "id" | "search"; matches: Match[] }
  | { ok: false; error: string; betId: number | null; hint?: string };

export const lookupBetInFeed = createServerFn({ method: "POST" })
  .inputValidator((input: { url?: string; query?: string; parceiro: Parceiro }) => {
    if (input.parceiro !== "seubet" && input.parceiro !== "h2bet")
      throw new Error("parceiro inválido");
    if (!input.url && !input.query) throw new Error("informe url ou query");
    return input;
  })
  .handler(async ({ data }): Promise<FeedLookupResult> => {
    let feed: Feed;
    try {
      feed = await getFeed(data.parceiro);
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : "Erro no feed",
        betId: null,
      };
    }

    // 1) tentativa por ID quando temos URL
    const betId = data.url ? extractBetId(data.url) : null;
    if (betId) {
      const found: Match[] = [];
      walkFeed(feed, data.parceiro, (m) => {
        if (m.betId === betId) found.push(m);
      });
      if (found.length > 0) return { ok: true, kind: "id", matches: found };
    }

    // 2) fallback: busca textual. Deriva query da URL se não veio explícita.
    const queryRaw =
      data.query?.trim() ||
      (data.url
        ? decodeURIComponent(data.url)
            .replace(/https?:\/\/[^/]+/, "")
            .replace(/[?&#].*$/, "")
            .replace(/[/_-]+/g, " ")
            .replace(/\d+/g, " ")
            .trim()
        : "");

    if (queryRaw && queryRaw.length >= 2) {
      const tokens = norm(queryRaw).split(" ").filter((t) => t.length >= 2);
      if (tokens.length > 0) {
        const scored: { m: Match; score: number }[] = [];
        walkFeed(feed, data.parceiro, (m) => {
          const hay = norm(`${m.team1} ${m.team2} ${m.competition} ${m.region}`);
          let score = 0;
          for (const t of tokens) if (hay.includes(t)) score += 1;
          if (score > 0) scored.push({ m, score });
        });
        scored.sort((a, b) => b.score - a.score || (a.m.startTs ?? 0) - (b.m.startTs ?? 0));
        const top = scored.slice(0, 20).map((s) => s.m);
        if (top.length > 0) return { ok: true, kind: "search", matches: top };
      }
    }

    return {
      ok: false,
      error:
        betId != null
          ? "Aposta não encontrada por ID. Tente buscar pelos nomes dos times."
          : "Nada encontrado. Digite o nome de um time ou da competição.",
      betId,
      hint:
        data.parceiro === "h2bet"
          ? "O bet_id do H2Bet não bate com o game_id do feed. Use a busca por time."
          : undefined,
    };
  });
