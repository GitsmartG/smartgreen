// Edge function: bet-tips
// Recebe { parceiro, url } e devolve dados estruturados de um bilhete
// de casa de apostas (SeuBet / H2Bet), buscando no FeedOdds e fazendo
// scraping do HTML do bilhete via proxy Bright Data.

// deno-lint-ignore-file no-explicit-any

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Parceiro = "seubet" | "h2bet";

interface RequestBody {
  parceiro: Parceiro;
  url: string;
}

interface MatchInfo {
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

interface BetTipsResult {
  ok: boolean;
  parceiro: Parceiro;
  error?: string;
  triedIds?: string[];
  match?: MatchInfo;
  matchedBy?: "id" | "game_number" | "url";
  matchedValue?: string;
  market?: string | null;
  odd?: number | null;
  titulo_sugerido?: string;
  htmlOk?: boolean;
  debug?: Record<string, unknown>;
}

interface SwarmSelection {
  sport: string;
  region: string;
  competition: string;
  gameId: string;
  gameNumber?: number | null;
  team1: string;
  team2: string;
  startMs?: number | null;
  market: string | null;
  odd: number | null;
  eventId: string;
}

// ------------------------------------------------------------------
// Fetch helpers
// ------------------------------------------------------------------
// O runtime edge do Supabase NÃO suporta Deno.createHttpClient / proxy
// via CONNECT. Se PROXY_HOST estiver configurado, a gente tenta usar
// mesmo assim (funciona em runtimes que suportam) e cai pra fetch
// direto se falhar. Feedodds funciona direto sem proxy; só o HTML da
// casa de apostas geralmente precisa.
let cachedClient: any = null;
let clientTried = false;
function getProxyClient(): any {
  if (clientTried) return cachedClient;
  clientTried = true;
  const host = Deno.env.get("PROXY_HOST");
  const port = Deno.env.get("PROXY_PORT");
  const user = Deno.env.get("PROXY_USER");
  const pass = Deno.env.get("PROXY_PASS");
  // @ts-ignore
  if (!host || !port || typeof Deno.createHttpClient !== "function") return null;
  try {
    const auth = user && pass
      ? `${encodeURIComponent(user)}:${encodeURIComponent(pass)}@`
      : "";
    // @ts-ignore
    cachedClient = Deno.createHttpClient({ proxy: { url: `http://${auth}${host}:${port}` } });
    return cachedClient;
  } catch (err) {
    console.warn("Falha criando proxy client (esperado no edge runtime):", err);
    return null;
  }
}

async function plainFetch(url: string, init: RequestInit = {}) {
  return fetch(url, {
    ...init,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
      ...(init.headers || {}),
    },
  });
}

async function proxiedFetch(url: string, init: RequestInit = {}) {
  const client = getProxyClient();
  if (client) {
    try {
      const merged: any = {
        ...init,
        client,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
          "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
          ...(init.headers || {}),
        },
      };
      return await fetch(url, merged);
    } catch (err) {
      console.warn("Proxy fetch falhou, tentando direto:", err);
    }
  }
  return plainFetch(url, init);
}

// ------------------------------------------------------------------
// URL parsing
// ------------------------------------------------------------------
function detectParceiroFromUrl(url: string): Parceiro | null {
  const s = url.toLowerCase();
  if (s.includes("seu.bet") || s.includes("seubet")) return "seubet";
  if (s.includes("h2.bet") || s.includes("h2bet")) return "h2bet";
  return null;
}

interface ParsedUrl {
  sport?: string;
  region?: string;
  competitionId?: string;
  gameId?: string;
  betId?: string;
  candidateIds: string[];
}

function parseBilheteUrl(rawUrl: string): ParsedUrl {
  const out: ParsedUrl = { candidateIds: [] };
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return out;
  }
  // /match/<sport>/<region>/<competitionId>/<gameId>
  const m = u.pathname.match(/\/match\/([^/]+)\/([^/]+)\/(\d+)\/(\d+)/i);
  if (m) {
    out.sport = decodeURIComponent(m[1]);
    out.region = decodeURIComponent(m[2]);
    out.competitionId = m[3];
    out.gameId = m[4];
  }
  const betId =
    u.searchParams.get("bet_id") ||
    u.searchParams.get("betId") ||
    u.searchParams.get("game_id") ||
    u.searchParams.get("gameId");
  if (betId) out.betId = betId;

  const seen = new Set<string>();
  const push = (v?: string) => {
    if (!v) return;
    if (!/^\d{4,}$/.test(v)) return;
    if (seen.has(v)) return;
    seen.add(v);
    out.candidateIds.push(v);
  };
  push(out.gameId);
  push(out.betId);
  for (const [, v] of u.searchParams) push(v);
  for (const seg of u.pathname.split("/")) push(seg);
  return out;
}

// ------------------------------------------------------------------
// FeedOdds lookup
// ------------------------------------------------------------------
const FEED_CACHE = new Map<string, { at: number; data: any }>();
const FEED_TTL_MS = 5 * 60 * 1000;

function feedConfig(parceiro: Parceiro) {
  if (parceiro === "seubet") {
    return {
      brandId: Deno.env.get("FEEDODDS_SEUBET_BRAND_ID"),
      key: Deno.env.get("FEEDODDS_SEUBET_KEY"),
    };
  }
  return {
    brandId: Deno.env.get("FEEDODDS_H2BET_BRAND_ID"),
    key: Deno.env.get("FEEDODDS_H2BET_KEY"),
  };
}

function swarmConfig(parceiro: Parceiro) {
  if (parceiro === "seubet") {
    return {
      siteId: 18749911,
      urls: [
        Deno.env.get("SWARM_SEUBET_URL"),
        "wss://swarm-novo.sistemas-086.workers.dev/",
        "wss://swarm-novo.seu.bet.br",
      ].filter(Boolean) as string[],
    };
  }
  return {
    siteId: 18749751,
    urls: [
      Deno.env.get("SWARM_H2BET_URL"),
      "wss://swarm-novo.h2.bet.br",
      "wss://swarm-novo.sistemas-086.workers.dev/",
    ].filter(Boolean) as string[],
  };
}

async function fetchFeed(parceiro: Parceiro): Promise<any> {
  const cfg = feedConfig(parceiro);
  if (!cfg.brandId || !cfg.key) {
    throw new Error(`Faltando FEEDODDS_${parceiro.toUpperCase()}_* secrets`);
  }
  const cacheKey = `${parceiro}:${cfg.brandId}:${cfg.key}`;
  const cached = FEED_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.at < FEED_TTL_MS) return cached.data;

  const url = `https://feedodds.com/feed/json?language=por_2&timeZone=UTC&brandId=${cfg.brandId}&key=${cfg.key}`;
  const res = await plainFetch(url);
  if (!res.ok) throw new Error(`feedodds retornou ${res.status}`);
  const data = await res.json();
  FEED_CACHE.set(cacheKey, { at: Date.now(), data });
  return data;
}

function parseStartTs(v: any): number | null {
  if (v == null) return null;
  if (typeof v === "number") return v > 1e12 ? v : v * 1000;
  if (typeof v === "string") {
    // "YYYY-MM-DD HH:MM:SS"
    const iso = v.includes("T") ? v : v.replace(" ", "T") + "Z";
    const t = Date.parse(iso);
    return Number.isFinite(t) ? t : null;
  }
  return null;
}

function walkFeedGames(
  feed: any,
): Array<{ game: any; sport: string; region: string; competition: string }> {
  const out: Array<{ game: any; sport: string; region: string; competition: string }> = [];
  const sports = feed?.sport || feed?.sports || feed;
  const iter = (obj: any, cb: (child: any, key: string) => void) => {
    if (Array.isArray(obj)) obj.forEach((v, i) => cb(v, String(i)));
    else if (obj && typeof obj === "object") {
      for (const k of Object.keys(obj)) cb(obj[k], k);
    }
  };
  iter(sports, (sportNode, sportKey) => {
    const sportName = sportNode?.name || sportNode?.title || sportKey;
    const regions = sportNode?.region || sportNode?.regions || {};
    iter(regions, (regionNode, regionKey) => {
      const regionName = regionNode?.name || regionKey;
      const comps = regionNode?.competition || regionNode?.competitions || {};
      iter(comps, (compNode, compKey) => {
        const compName = compNode?.name || compKey;
        const games = compNode?.game || compNode?.games || {};
        iter(games, (game) => {
          if (game && typeof game === "object") {
            out.push({
              game,
              sport: String(sportName),
              region: String(regionName),
              competition: String(compName),
            });
          }
        });
      });
    });
  });
  return out;
}

function gameMatchesCandidate(game: any, cand: string): string | null {
  // 1) Campos diretos de ID
  for (const [k, v] of Object.entries(game)) {
    if (v == null || typeof v === "object") continue;
    if (String(v) !== cand) continue;
    if (/id$/i.test(k) || /number$/i.test(k) || k === "id" || k === "game_id") {
      return k;
    }
  }
  // 2) Procura em markets → events (bet_id do Betconstruct = event id)
  const markets = game.market || game.markets || {};
  const iter = (obj: any, cb: (v: any) => void) => {
    if (Array.isArray(obj)) obj.forEach(cb);
    else if (obj && typeof obj === "object") Object.values(obj).forEach(cb);
  };
  let hit: string | null = null;
  iter(markets, (m) => {
    if (hit) return;
    const events = m?.event || m?.events || {};
    iter(events, (ev) => {
      if (hit) return;
      if (ev && typeof ev === "object" && String(ev.id ?? "") === cand) {
        hit = "event_id";
      }
    });
  });
  return hit;
}


function findEventInGame(
  game: any,
  cand: string,
): { market: string; odd: number } | null {
  const markets = game.market || game.markets || {};
  const iter = (obj: any, cb: (v: any, k: string) => void) => {
    if (Array.isArray(obj)) obj.forEach((v, i) => cb(v, String(i)));
    else if (obj && typeof obj === "object") {
      for (const k of Object.keys(obj)) cb(obj[k], k);
    }
  };
  let hit: { market: string; odd: number } | null = null;
  iter(markets, (m) => {
    if (hit) return;
    const mName = m?.name || m?.market_name || m?.caption || m?.type || "";
    const events = m?.event || m?.events || {};
    iter(events, (ev) => {
      if (hit) return;
      if (!ev || typeof ev !== "object") return;
      if (String(ev.id ?? "") !== cand) return;
      const odd = Number(ev.price ?? ev.coefficient ?? ev.odd ?? ev.k ?? NaN);
      const evName = ev.name || ev.caption || ev.type_1 || "";
      const label = [mName, evName].filter(Boolean).join(" — ");
      if (Number.isFinite(odd)) hit = { market: label || String(mName), odd };
    });
  });
  return hit;
}

function findGameInFeed(
  feed: any,
  candidates: string[],
): {
  match: MatchInfo;
  matchedBy: "id" | "game_number";
  matchedValue: string;
  feedMarket?: string;
  feedOdd?: number;
} | null {
  const games = walkFeedGames(feed);
  for (const cand of candidates) {
    for (const { game, sport, region, competition } of games) {
      const matchedField = gameMatchesCandidate(game, cand);
      if (!matchedField) continue;
      const team1 =
        game.team1_name || game.team1 || game.home || game.home_team || "";
      const team2 =
        game.team2_name || game.team2 || game.away || game.away_team || "";
      const ev = matchedField === "event_id" ? findEventInGame(game, cand) : null;
      return {
        matchedBy: matchedField === "game_number" ? "game_number" : "id",
        matchedValue: cand,
        feedMarket: ev?.market,
        feedOdd: ev?.odd,
        match: {
          sport,
          region,
          competition,
          event: `${team1} x ${team2}`.trim(),
          team1: String(team1),
          team2: String(team2),
          betId: String(game.id ?? cand),
          gameNumber: game.game_number ?? null,
          startMs: parseStartTs(game.start_ts ?? game.startTs ?? game.start_time),
        },
      };
    }
  }
  return null;
}

// ------------------------------------------------------------------
// BetConstruct Swarm WebSocket lookup (mercado + odd)
// ------------------------------------------------------------------
function translate(v: any): string {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (typeof v !== "object") return "";
  for (const key of ["pt-br", "por", "por_2", "br", "eng", "en", "name"]) {
    if (v[key]) return String(v[key]);
  }
  const first = Object.values(v).find((x) => typeof x === "string" || typeof x === "number");
  return first == null ? "" : String(first);
}

function appendBase(name: string, base: any): string {
  const baseText = base == null ? "" : String(base);
  if (!baseText || name.includes(baseText)) return name;
  return `${name} (${baseText})`;
}

function formatMarket(market: any, event: any): string | null {
  const marketName = appendBase(translate(market?.name), market?.base).trim();
  const eventName = appendBase(translate(event?.name), event?.base).trim();
  if (marketName && eventName && marketName !== eventName) return `${marketName} — ${eventName}`;
  return marketName || eventName || null;
}

function numberOrNull(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function entries(obj: any): Array<[string, any]> {
  if (!obj || typeof obj !== "object") return [];
  return Object.entries(obj);
}

function flattenSwarmSelections(payload: any): SwarmSelection[] {
  const root = payload?.data?.data ?? payload?.data ?? payload;
  const sports = root?.sport ?? {};
  const out: SwarmSelection[] = [];

  for (const [sportId, sport] of entries(sports)) {
    const sportName = translate(sport?.name) || translate(sport?.alias) || sportId;
    for (const [regionId, region] of entries(sport?.region)) {
      const regionName = translate(region?.name) || translate(region?.alias) || regionId;
      for (const [, competition] of entries(region?.competition)) {
        const competitionName = translate(competition?.name);
        for (const [gameId, game] of entries(competition?.game)) {
          const team1 = translate(game?.team1_name || game?.team1);
          const team2 = translate(game?.team2_name || game?.team2);
          for (const [, market] of entries(game?.market)) {
            for (const [eventId, event] of entries(market?.event)) {
              const odd = numberOrNull(event?.price);
              out.push({
                sport: sportName,
                region: regionName,
                competition: competitionName,
                gameId: String(game?.id ?? gameId),
                gameNumber: game?.game_number ?? null,
                team1,
                team2,
                startMs: parseStartTs(game?.start_ts ?? game?.start_time),
                market: formatMarket(market, event),
                odd,
                eventId: String(event?.id ?? eventId),
              });
            }
          }
        }
      }
    }
  }

  return out;
}

function swarmWhat() {
  return {
    sport: ["alias", "id", "type", "name"],
    region: ["name", "alias", "id"],
    competition: ["name", "id"],
    game: ["id", "team1_name", "team2_name", "start_ts", "game_number", "type"],
    market: ["name", "type", "base"],
    event: ["id", "name", "type", "base", "price"],
  };
}

function buildSwarmRequests(parsed: ParsedUrl) {
  const what = swarmWhat();
  const requests: Array<{ command: string; rid: string; params: Record<string, unknown> }> = [];
  const seen = new Set<string>();

  const add = (rid: string, where: Record<string, unknown>) => {
    if (seen.has(rid)) return;
    seen.add(rid);
    requests.push({
      command: "get",
      rid,
      params: { source: "betting", what, where, subscribe: false },
    });
  };

  if (parsed.betId && /^\d+$/.test(parsed.betId)) {
    add(`event_${parsed.betId}`, { event: { id: Number(parsed.betId) } });
  }
  if (parsed.gameId && /^\d+$/.test(parsed.gameId)) {
    add(`game_${parsed.gameId}`, { game: { id: Number(parsed.gameId) } });
  }
  for (const cand of parsed.candidateIds) {
    if (/^\d+$/.test(cand)) add(`event_${cand}`, { event: { id: Number(cand) } });
  }

  return requests;
}

async function callSwarm(url: string, siteId: number, requests: ReturnType<typeof buildSwarmRequests>) {
  return await new Promise<any[]>((resolve, reject) => {
    const ws = new WebSocket(url);
    const responses: any[] = [];
    let sessionReady = false;
    const pending = new Set(requests.map((r) => r.rid));
    const timeout = setTimeout(() => {
      try {
        ws.close();
      } catch {
        // noop
      }
      reject(new Error("Timeout no WebSocket Swarm"));
    }, 12000);

    const finish = () => {
      clearTimeout(timeout);
      try {
        ws.close();
      } catch {
        // noop
      }
      resolve(responses);
    };

    ws.onopen = () => {
      ws.send(JSON.stringify({
        command: "request_session",
        params: { language: "pt-br", site_id: siteId, source: 42, is_wrap_app: false },
        rid: "request_session",
      }));
    };

    ws.onmessage = (event) => {
      let msg: any;
      try {
        msg = JSON.parse(String(event.data));
      } catch {
        return;
      }

      if (msg?.rid === "request_session") {
        if (Number(msg.code) !== 0) {
          clearTimeout(timeout);
          reject(new Error(msg?.msg || "Swarm recusou request_session"));
          return;
        }
        sessionReady = true;
        if (requests.length === 0) {
          finish();
          return;
        }
        for (const req of requests) ws.send(JSON.stringify(req));
        return;
      }

      if (!sessionReady || !msg?.rid || !pending.has(String(msg.rid))) return;
      pending.delete(String(msg.rid));
      if (Number(msg.code) === 0) responses.push(msg);
      if (pending.size === 0) finish();
    };

    ws.onerror = () => {
      clearTimeout(timeout);
      reject(new Error("Falha conectando no WebSocket Swarm"));
    };

    ws.onclose = () => {
      if (!sessionReady) {
        clearTimeout(timeout);
        reject(new Error("WebSocket Swarm fechou antes da sessão"));
      }
    };
  });
}

async function fetchSwarmSelection(
  parceiro: Parceiro,
  parsed: ParsedUrl,
): Promise<SwarmSelection | null> {
  const cfg = swarmConfig(parceiro);
  const requests = buildSwarmRequests(parsed);
  if (requests.length === 0) return null;

  let lastError: unknown = null;
  for (const url of cfg.urls) {
    try {
      const responses = await callSwarm(url, cfg.siteId, requests);
      const selections = responses.flatMap((r) => flattenSwarmSelections(r));
      const preferred = [parsed.betId, ...parsed.candidateIds].filter(Boolean).map(String);
      for (const id of preferred) {
        const hit = selections.find((s) => s.eventId === id && s.odd != null);
        if (hit) return hit;
      }
      const firstWithOdd = selections.find((s) => s.odd != null);
      if (firstWithOdd) return firstWithOdd;
    } catch (err) {
      lastError = err;
      console.warn(`Swarm falhou em ${url}:`, err);
    }
  }

  if (lastError) console.warn("Todas as URLs Swarm falharam", lastError);
  return null;
}



// ------------------------------------------------------------------
// HTML scraping do bilhete (mercado + odd)
// ------------------------------------------------------------------
async function fetchBilheteHtml(url: string): Promise<string | null> {
  try {
    const res = await proxiedFetch(url, {
      headers: { Accept: "text/html,application/xhtml+xml" },
    });
    if (!res.ok) {
      console.warn(`bilhete HTML ${res.status}`);
      return null;
    }
    return await res.text();
  } catch (err) {
    console.warn("Erro fetch bilhete:", err);
    return null;
  }
}

function extractMarketAndOdd(
  html: string,
  betId?: string,
): { market: string | null; odd: number | null } {
  if (!html) return { market: null, odd: null };
  let market: string | null = null;
  let odd: number | null = null;

  // 1) JSON embutido tipo __NUXT__/__NEXT_DATA__/INIT_STATE — procura por betId
  if (betId) {
    // Regex: procura "id":<betId>[...],"price":X.XX ou "coefficient":X.XX
    const idPattern = new RegExp(
      `"(?:id|bet_id|betId)"\\s*:\\s*"?${betId}"?[\\s\\S]{0,600}?"(?:price|coefficient|odd)"\\s*:\\s*"?(\\d+(?:\\.\\d+)?)`,
      "i",
    );
    const om = html.match(idPattern);
    if (om) odd = Number(om[1]);

    // Nome do mercado próximo ao betId
    const marketPattern = new RegExp(
      `"(?:id|bet_id|betId)"\\s*:\\s*"?${betId}"?[\\s\\S]{0,600}?"(?:market_name|marketName|market|name|caption)"\\s*:\\s*"([^"]{2,120})"`,
      "i",
    );
    const mm = html.match(marketPattern);
    if (mm) market = mm[1];
  }

  // 2) Fallback: og:description costuma ter "Time1 x Time2 · Mercado · Odd"
  if (!market) {
    const og = html.match(
      /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
    );
    if (og) market = og[1];
  }

  return { market, odd };
}

// ------------------------------------------------------------------
// Handler
// ------------------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (req.method !== "POST") {
      return json({ ok: false, error: "Método inválido", parceiro: "seubet" }, 405);
    }
    const body = (await req.json()) as RequestBody;
    if (!body?.url || !body?.parceiro) {
      return json(
        { ok: false, error: "url e parceiro são obrigatórios", parceiro: body?.parceiro ?? "seubet" },
        400,
      );
    }
    const parceiro = body.parceiro;
    const url = body.url.trim();

    // Valida parceiro vs URL
    const detected = detectParceiroFromUrl(url);
    if (detected && detected !== parceiro) {
      return json({
        ok: false,
        parceiro,
        error: `URL é de ${detected === "seubet" ? "SeuBet" : "H2Bet"}, mas você selecionou ${
          parceiro === "seubet" ? "SeuBet" : "H2Bet"
        }.`,
        triedIds: [],
      });
    }

    const parsed = parseBilheteUrl(url);
    if (parsed.candidateIds.length === 0) {
      return json({
        ok: false,
        parceiro,
        error: "Não consegui extrair nenhum ID da URL. Verifique se o link está completo.",
        triedIds: [],
      });
    }

    // Primeiro tenta o mesmo fluxo do parceiro: WebSocket Swarm → request_session → get betting.
    // É aqui que vem mercado/odd; o FeedOdds fica como fallback para dados do jogo.
    let swarmSelection: SwarmSelection | null = null;
    try {
      swarmSelection = await fetchSwarmSelection(parceiro, parsed);
    } catch (err) {
      console.warn("Swarm lookup falhou:", err);
    }

    if (swarmSelection) {
      const match: MatchInfo = {
        sport: swarmSelection.sport,
        region: swarmSelection.region,
        competition: swarmSelection.competition,
        event: `${swarmSelection.team1} x ${swarmSelection.team2}`.trim(),
        team1: swarmSelection.team1,
        team2: swarmSelection.team2,
        betId: swarmSelection.eventId,
        gameId: swarmSelection.gameId,
        gameNumber: swarmSelection.gameNumber,
        startMs: swarmSelection.startMs,
      };
      return json({
        ok: true,
        parceiro,
        match,
        matchedBy: "id",
        matchedValue: swarmSelection.eventId,
        market: swarmSelection.market,
        odd: swarmSelection.odd,
        titulo_sugerido: `${match.team1} x ${match.team2}${swarmSelection.market ? ` — ${swarmSelection.market}` : ""}`,
        htmlOk: false,
      });
    }

    // Feed lookup como fallback quando a odd não estiver disponível no Swarm.
    let feed: any;
    try {
      feed = await fetchFeed(parceiro);
    } catch (err) {
      return json({
        ok: false,
        parceiro,
        error: err instanceof Error ? err.message : "Falha no feed",
        triedIds: parsed.candidateIds,
      });
    }

    const found = findGameInFeed(feed, parsed.candidateIds);
    if (!found) {
      return json({
        ok: false,
        parceiro,
        error: `Aposta não encontrada no feed do ${
          parceiro === "seubet" ? "SeuBet" : "H2Bet"
        }.`,
        triedIds: parsed.candidateIds,
      });
    }

    // Prefere market/odd que veio direto do feed (via event_id).
    // Se não veio, tenta scraping do HTML.
    let market: string | null = found.feedMarket ?? null;
    let odd: number | null = found.feedOdd ?? null;
    let htmlOk = false;
    if (market == null || odd == null) {
      const html = await fetchBilheteHtml(url);
      htmlOk = !!html;
      if (html) {
        const scraped = extractMarketAndOdd(html, parsed.betId || parsed.gameId);
        market = market ?? scraped.market;
        odd = odd ?? scraped.odd;
      }
    }

    const titulo = `${found.match.team1} x ${found.match.team2}${
      market ? ` — ${market}` : ""
    }`;


    const result: BetTipsResult = {
      ok: true,
      parceiro,
      match: found.match,
      matchedBy: found.matchedBy,
      matchedValue: found.matchedValue,
      market,
      odd,
      titulo_sugerido: titulo,
      htmlOk,

    };
    return json(result);
  } catch (err) {
    console.error("bet-tips error:", err);
    return json(
      {
        ok: false,
        parceiro: "seubet",
        error: err instanceof Error ? err.message : "Erro desconhecido",
        triedIds: [],
      },
      500,
    );
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
