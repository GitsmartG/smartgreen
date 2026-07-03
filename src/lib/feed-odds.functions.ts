import { createServerFn } from "@tanstack/react-start";

type FeedGame = {
  id: number | string;
  team1_name?: string;
  team2_name?: string;
  start_ts?: number | string;
  game_number?: number | string;
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

export type Parceiro = keyof typeof FEEDS;

// Cache do feed por 5 min (por processo)
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

// Detecta o parceiro pelo domínio da URL
export function detectParceiroFromUrl(url: string): Parceiro | null {
  const s = url.toLowerCase();
  if (/(?:^|\/\/|\.)seu\.?bet(?:\.|\/)/.test(s) || s.includes("seubet")) return "seubet";
  if (/(?:^|\/\/|\.)h2\.?bet(?:\.|\/)/.test(s) || s.includes("h2bet")) return "h2bet";
  return null;
}

// Extrai TODOS os números candidatos da URL (>=4 dígitos), ordenados por prioridade
function extractCandidateIds(url: string): number[] {
  const cands = new Set<number>();
  try {
    const u = new URL(url);
    // params conhecidos primeiro
    for (const p of ["bet_id", "game_id", "id", "gameId", "betId", "eventId", "event_id"]) {
      const v = u.searchParams.get(p);
      if (v && /^\d+$/.test(v)) cands.add(Number(v));
    }
  } catch {
    /* ignora URL malformada */
  }
  // depois qualquer número >=4 dígitos que aparecer na string
  const all = url.match(/\d{4,}/g) ?? [];
  for (const n of all) cands.add(Number(n));
  return [...cands];
}

// start_ts pode vir como "YYYY-MM-DD HH:MM:SS" (UTC) ou unix seconds
function parseStart(v: FeedGame["start_ts"]): number | null {
  if (v == null) return null;
  if (typeof v === "number") return v * 1000;
  if (/^\d+$/.test(v)) return Number(v) * 1000;
  // "2026-07-03 22:00:00" -> ISO com Z (feed é UTC)
  const iso = v.replace(" ", "T") + "Z";
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
}

export type FeedMatch = {
  betId: number;
  gameNumber: number | null;
  parceiro: Parceiro;
  sport: string;
  competition: string;
  region: string;
  event: string;
  team1: string;
  team2: string;
  startMs: number | null;
};

export type FeedLookupResult =
  | { ok: true; match: FeedMatch; matchedBy: "id" | "game_number"; matchedValue: number }
  | { ok: false; error: string; triedIds: number[]; parceiro: Parceiro | null };

export const lookupBetInFeed = createServerFn({ method: "POST" })
  .inputValidator((input: { url: string; parceiro?: Parceiro }) => {
    if (!input || typeof input.url !== "string" || !input.url.trim())
      throw new Error("url obrigatória");
    return input;
  })
  .handler(async ({ data }): Promise<FeedLookupResult> => {
    const detected = detectParceiroFromUrl(data.url);
    const parceiro = detected ?? data.parceiro ?? null;

    if (!parceiro)
      return {
        ok: false,
        error: "Não reconheci o parceiro da URL. Use um link do SeuBet ou H2Bet.",
        triedIds: [],
        parceiro: null,
      };

    if (data.parceiro && detected && detected !== data.parceiro)
      return {
        ok: false,
        error: `URL é do ${detected === "seubet" ? "SeuBet" : "H2Bet"}, mas o parceiro selecionado é ${data.parceiro === "seubet" ? "SeuBet" : "H2Bet"}. Troca o parceiro ou cola a URL certa.`,
        triedIds: [],
        parceiro: detected,
      };

    const candidates = extractCandidateIds(data.url);
    if (candidates.length === 0)
      return {
        ok: false,
        error: "Não achei nenhum ID numérico na URL.",
        triedIds: [],
        parceiro,
      };

    let feed: Feed;
    try {
      feed = await getFeed(parceiro);
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : "Erro ao buscar o feed",
        triedIds: candidates,
        parceiro,
      };
    }

    // Indexa feed por id e por game_number
    const byId = new Map<number, FeedMatch>();
    const byGameNumber = new Map<number, FeedMatch>();
    for (const sport of Object.values(feed.sport ?? {})) {
      for (const region of Object.values(sport.region ?? {})) {
        for (const comp of Object.values(region.competition ?? {})) {
          for (const game of Object.values(comp.game ?? {})) {
            const team1 = game.team1_name ?? "";
            const team2 = game.team2_name ?? "";
            const m: FeedMatch = {
              betId: Number(game.id),
              gameNumber: game.game_number != null ? Number(game.game_number) : null,
              parceiro,
              sport: sport.name,
              competition: comp.name,
              region: region.alias,
              event: team1 && team2 ? `${team1} x ${team2}` : team1 || team2 || comp.name,
              team1,
              team2,
              startMs: parseStart(game.start_ts),
            };
            byId.set(m.betId, m);
            if (m.gameNumber != null) byGameNumber.set(m.gameNumber, m);
          }
        }
      }
    }

    for (const cand of candidates) {
      const hit = byId.get(cand);
      if (hit) return { ok: true, match: hit, matchedBy: "id", matchedValue: cand };
    }
    for (const cand of candidates) {
      const hit = byGameNumber.get(cand);
      if (hit) return { ok: true, match: hit, matchedBy: "game_number", matchedValue: cand };
    }

    return {
      ok: false,
      error: "Aposta não encontrada no feed desse parceiro.",
      triedIds: candidates,
      parceiro,
    };
  });
