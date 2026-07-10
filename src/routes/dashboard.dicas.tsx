import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { loadTickets, saveTickets, type Ticket, type TicketLegResult, type TipStatus, type Parceiro as ParceiroT } from "@/lib/tickets-store";
import { importBetTip, type BetTipsResult } from "@/lib/bet-tips";
import { getSoccerLivescores, type LiveMatch } from "@/lib/livescores.functions";
import { getTodayMatches, getMatchesByDate } from "@/lib/daily-matches.functions";
import { findMatchForTicket, gradePalpite, gradeSinglePalpite } from "@/lib/auto-settle";
import { getMatchRichData, type RichMatchResponse } from "@/lib/soccer-details.functions";
import { getCachedRich, setCachedRich } from "@/lib/rich-cache";
import { getCachedLogo, setCachedLogo, markLogoBroken } from "@/lib/logo-cache";
import { Loader2, AlertCircle, Activity, ShieldAlert, Zap, PieChart } from "lucide-react";

import {
  Search,
  RefreshCw,
  Plus,
  MoreHorizontal,
  Radio,
  TrendingUp,
  Calendar,
  Eye,
  X,
  Wand2,
  Pencil,
  Sparkles,
  Check,
} from "lucide-react";
import { useIsDark } from "@/hooks/use-is-dark";

type Parceiro = ParceiroT;
const PARCEIROS: { value: Parceiro; label: string; hint?: string }[] = [
  { value: "seubet", label: "SeuBet" },
  { value: "h2bet", label: "H2Bet" },
];

function detectParceiro(value: string): Parceiro | null {
  const s = value.toLowerCase();
  if (s.includes("seu.bet") || s.includes("seubet")) return "seubet";
  if (s.includes("h2.bet") || s.includes("h2bet")) return "h2bet";
  return null;
}

function getErrorMessage(value: unknown): string {
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


export const Route = createFileRoute("/dashboard/dicas")({
  component: DicasPage,
});

type Tab = "todos" | "aguardando" | "ao_vivo" | "green" | "red";

type LegLive = {
  matchId: string;
  live: boolean;
  finished: boolean;
  score1: number | null;
  score2: number | null;
  minute?: string;
  team1: string;
  team2: string;
  team1Logo?: string;
  team2Logo?: string;
  team1Id?: string;
  team2Id?: string;
  swapped: boolean;
  status: TipStatus;
};

type MultiGame = { team1: string; team2: string };

type MatchLogoSource = {
  id: string;
  status: string;
  live: boolean;
  finished: boolean;
  home: { name: string; goals: number | null; id?: string; image?: string };
  away: { name: string; goals: number | null; id?: string; image?: string };
};

type MatchLogoPayload = {
  leagues?: Array<{ matches?: MatchLogoSource[] }>;
};

type LiveState = {
  status?: string;
  live: boolean;
  finished: boolean;
  score1: number | null;
  score2: number | null;
  minute?: string;
  team1Logo?: string;
  team2Logo?: string;
  team1Id?: string;
  team2Id?: string;
  swapped: boolean;
  legs?: Record<number, LegLive>;
};

const MATCH_AUTO_CLOSE_MS = 3 * 60 * 60 * 1000;

// Keys em inglês normalizado — normalizedText() traduz PT→EN antes do lookup.
const FLAG_LOGOS: Record<string, string> = {
  argentina: "🇦🇷", brazil: "🇧🇷", uruguay: "🇺🇾", paraguay: "🇵🇾", chile: "🇨🇱",
  colombia: "🇨🇴", peru: "🇵🇪", ecuador: "🇪🇨", bolivia: "🇧🇴", venezuela: "🇻🇪",
  usa: "🇺🇸", mexico: "🇲🇽", canada: "🇨🇦", costa: "🇨🇷", "costa rica": "🇨🇷",
  panama: "🇵🇦", honduras: "🇭🇳", jamaica: "🇯🇲",
  england: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", scotland: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", wales: "🏴󠁧󠁢󠁷󠁬󠁳󠁿", ireland: "🇮🇪",
  france: "🇫🇷", germany: "🇩🇪", spain: "🇪🇸", italy: "🇮🇹", portugal: "🇵🇹",
  netherlands: "🇳🇱", belgium: "🇧🇪", switzerland: "🇨🇭", austria: "🇦🇹",
  poland: "🇵🇱", denmark: "🇩🇰", sweden: "🇸🇪", norway: "🇳🇴", finland: "🇫🇮",
  croatia: "🇭🇷", serbia: "🇷🇸", greece: "🇬🇷", turkey: "🇹🇷", russia: "🇷🇺",
  ukraine: "🇺🇦", czech: "🇨🇿", "czech republic": "🇨🇿", slovakia: "🇸🇰",
  hungary: "🇭🇺", romania: "🇷🇴", bulgaria: "🇧🇬", albania: "🇦🇱",
  egypt: "🇪🇬", morocco: "🇲🇦", tunisia: "🇹🇳", algeria: "🇩🇿", senegal: "🇸🇳",
  nigeria: "🇳🇬", ghana: "🇬🇭", cameroon: "🇨🇲", ivory: "🇨🇮", "ivory coast": "🇨🇮",
  "south africa": "🇿🇦", kenya: "🇰🇪",
  japan: "🇯🇵", "south korea": "🇰🇷", korea: "🇰🇷", china: "🇨🇳", australia: "🇦🇺",
  "saudi arabia": "🇸🇦", qatar: "🇶🇦", iran: "🇮🇷", iraq: "🇮🇶", uae: "🇦🇪",
  "united arab emirates": "🇦🇪", israel: "🇮🇱",
};

const LIVE_PALETTE = {
  amber: {
    base: "text-amber-500 border-amber-500/40 bg-amber-500/10",
    activeRing: "ring-2 ring-amber-500/50",
  },
  emerald: {
    base: "text-emerald-500 border-emerald-500/40 bg-emerald-500/10",
    activeRing: "ring-2 ring-emerald-500/50",
  },
  red: {
    base: "text-red-500 border-red-500/40 bg-red-500/10",
    activeRing: "ring-2 ring-red-500/50",
  },
  sky: {
    base: "text-sky-500 border-sky-500/40 bg-sky-500/10",
    activeRing: "ring-2 ring-sky-500/50",
  },
} as const;

function DicasPage() {
  const isDark = useIsDark();
  const fetchSoccerLivescores = useServerFn(getSoccerLivescores);
  const fetchTodayMatches = useServerFn(getTodayMatches);
  const fetchMatchesByDate = useServerFn(getMatchesByDate);

  const panel = isDark
    ? "bg-neutral-900 border-neutral-800"
    : "bg-white border-neutral-200";
  const muted = isDark ? "text-neutral-400" : "text-neutral-500";
  const subtle = isDark ? "text-neutral-500" : "text-neutral-500";

  const inputCls =
    "h-10 w-full rounded-md border pl-9 pr-3 text-sm outline-none transition-colors " +
    (isDark
      ? "bg-neutral-950 border-neutral-800 text-neutral-100 placeholder:text-neutral-600 focus:border-emerald-600"
      : "bg-white border-neutral-300 text-neutral-900 placeholder:text-neutral-400 focus:border-emerald-700");
  const selectCls =
    "h-10 rounded-md border px-3 text-sm outline-none transition-colors " +
    (isDark
      ? "bg-neutral-950 border-neutral-800 text-neutral-100 focus:border-emerald-600"
      : "bg-white border-neutral-300 text-neutral-900 focus:border-emerald-700");

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const ticketsRef = useRef<Ticket[]>(tickets);
  const ticketList = Array.isArray(tickets) ? tickets : [];

  // Carrega tickets do storage só no client (evita SSR mismatch e hooks count divergente).
  useEffect(() => {
    setTickets(loadTickets());
    setHydrated(true);
    // Puxa do backend em background e merge (server wins).
    void import("@/lib/tickets-store").then(async (m) => {
      const merged = await m.hydrateTicketsFromServer();
      if (merged) setTickets(merged);
    });
  }, []);

  useEffect(() => {
    ticketsRef.current = ticketList;
  }, [ticketList]);

  useEffect(() => {
    if (!hydrated) return;
    saveTickets(ticketList);
  }, [ticketList, hydrated]);

  const [liveMap, setLiveMap] = useState<Record<string, LiveState>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [lastCheckMs, setLastCheckMs] = useState<number | null>(null);

  const runCheck = async () => {
    const currentTickets = Array.isArray(ticketsRef.current) ? ticketsRef.current : [];
    const relevant = currentTickets.filter((t) => (t.esporte || "").toLowerCase().includes("fute"));
    if (!relevant.length) return;
    setRefreshing(true);
    try {
      // Coleta datas relevantes dos tickets pendentes (aguardando/ao_vivo)
      // pra buscar o feed do dia correto e conseguir gradar bilhetes antigos.
      const extraDates = collectTicketDates(relevant);
      const [liveResult, todayResult, ...extraResults] = await Promise.allSettled([
        fetchSoccerLivescores(),
        fetchTodayMatches(),
        ...extraDates.map((d: string) => fetchMatchesByDate({ data: { date: d } })),
      ]);
      const liveMatches =
        liveResult.status === "fulfilled" && liveResult.value.ok && Array.isArray(liveResult.value.matches)
          ? liveResult.value.matches
          : [];
      const todayPayload =
        todayResult.status === "fulfilled" && todayResult.value.ok ? todayResult.value.payload : undefined;
      const extraPayloads = extraResults
        .map((r) => (r.status === "fulfilled" && r.value.ok ? r.value.payload : undefined))
        .filter((p): p is NonNullable<typeof p> => Boolean(p));
      const combinedFromPayloads = [todayPayload, ...extraPayloads]
        .filter((p): p is NonNullable<typeof p> => Boolean(p))
        .flatMap((p) => payloadToLiveMatches(p));
      const matches = mergeLiveMatches(combinedFromPayloads, liveMatches);

      const nextLive: Record<string, LiveState> = {};
      for (const t of currentTickets) {
        const rawMatch = findMatchForTicket(t, matches);
        const m = rawMatch ? closeExpiredMatch(t, rawMatch) : null;
        let entry: LiveState | null = null;
        if (m) {
          const swapped = isSwappedMatch(t, m.team1, m.team2);
          const alreadyResolved = t.status === "green" || t.status === "red";
          entry = {
            status: m.status,
            live: alreadyResolved ? false : m.live,
            finished: alreadyResolved ? true : m.finished,
            score1: swapped ? m.score2 : m.score1,
            score2: swapped ? m.score1 : m.score2,
            minute: m.minute,
            team1Logo: swapped ? m.team2Logo : m.team1Logo,
            team2Logo: swapped ? m.team1Logo : m.team2Logo,
            team1Id: swapped ? m.team2Id : m.team1Id,
            team2Id: swapped ? m.team1Id : m.team2Id,
            swapped,
          };
        }
        // Per-leg matching (multipla)
        const multiGames = extractMultiGames(t.event);
        const isMult = isMultiplaTicket(t) || multiGames.length > 1;
        if (isMult) {
          const legs = splitPalpites(t.palpite);
          if (legs.length > 1 || multiGames.length > 1) {
            const legMap: Record<number, LegLive> = {};
            const totalLegs = Math.max(legs.length, multiGames.length);
            for (let i = 0; i < totalLegs; i += 1) {
              const game = gameForLeg(i, totalLegs, multiGames);
              const legText = legs[i] ?? `${game?.team1 ?? ""} ${game?.team2 ?? ""}`;
              const found = findMatchForLeg(legText, matches, game);
              const previousLeg = t.legResults?.[i];
              const lm = found ? closeExpiredMatch(t, found.match) : legResultToFinishedMatch(previousLeg, game, i, t);
              if (!lm) continue;
              const graded = gradeSinglePalpite(legText, lm, ticketForLeg(t, game));
              const status: TipStatus =
                graded ?? preservedFinishedStatus(previousLeg?.status, lm);
              legMap[i] = {
                matchId: lm.id,
                live: lm.live,
                finished: lm.finished,
                score1: lm.score1,
                score2: lm.score2,
                minute: lm.minute,
                team1: lm.team1,
                team2: lm.team2,
                team1Logo: lm.team1Logo,
                team2Logo: lm.team2Logo,
                team1Id: lm.team1Id,
                team2Id: lm.team2Id,
                swapped: false,
                status,
              };
            }
            entry = { ...(entry ?? { live: false, finished: false, score1: null, score2: null, swapped: false }), legs: legMap };
          }
        }
        if (entry) nextLive[t.id] = entry;
      }
      setLiveMap(nextLive);

      setTickets((prev) => {
        let changed = false;
        const safePrev = Array.isArray(prev) ? prev : [];
        const next = safePrev.map((t) => {
          if (!(t.esporte || "").toLowerCase().includes("fute")) return t;
          const rawMatch = findMatchForTicket(t, matches);
          const m = rawMatch ? closeExpiredMatch(t, rawMatch) : null;
          const multiGames = extractMultiGames(t.event);
          const isMult = isMultiplaTicket(t) || multiGames.length > 1;
          const legs = splitPalpites(t.palpite);
          const totalLegs = isMult ? Math.max(legs.length, multiGames.length) : 0;
          let legResults: Record<number, TicketLegResult> | undefined;
          let legChanged = false;
          if (isMult && totalLegs > 0) {
            legResults = { ...(t.legResults ?? {}) };
            for (let i = 0; i < totalLegs; i += 1) {
              const game = gameForLeg(i, totalLegs, multiGames);
              const legText = legs[i] ?? `${game?.team1 ?? ""} ${game?.team2 ?? ""}`;
              const found = findMatchForLeg(legText, matches, game);
              const previousLeg = legResults[i] ?? t.legResults?.[i];
              const lm = found ? closeExpiredMatch(t, found.match) : legResultToFinishedMatch(previousLeg, game, i, t);
              if (!lm) continue;
              const status = gradeSinglePalpite(legText, lm, ticketForLeg(t, game)) ?? preservedFinishedStatus(previousLeg?.status, lm);
              const nextLeg: TicketLegResult = {
                matchId: lm.id,
                live: lm.live,
                finished: lm.finished,
                score1: lm.score1,
                score2: lm.score2,
                minute: lm.minute,
                team1: lm.team1,
                team2: lm.team2,
                team1Logo: lm.team1Logo,
                team2Logo: lm.team2Logo,
                team1Id: lm.team1Id,
                team2Id: lm.team2Id,
                swapped: false,
                status,
              };
              if (JSON.stringify(legResults[i] ?? {}) !== JSON.stringify(nextLeg)) {
                legResults[i] = nextLeg;
                legChanged = true;
              }
            }
          }
          if (m) {
            const swapped = isSwappedMatch(t, m.team1, m.team2);
            const score1 = swapped ? m.score2 : m.score1;
            const score2 = swapped ? m.score1 : m.score2;
            const team1Logo = swapped ? m.team2Logo : m.team1Logo;
            const team2Logo = swapped ? m.team1Logo : m.team2Logo;
            const patch: Partial<Ticket> = { resultCheckedAtMs: Date.now() };
            if (t.score1 !== score1) patch.score1 = score1;
            if (t.score2 !== score2) patch.score2 = score2;
            if (team1Logo && t.team1Logo !== team1Logo) patch.team1Logo = team1Logo;
            if (team2Logo && t.team2Logo !== team2Logo) patch.team2Logo = team2Logo;
            if (legChanged && legResults) patch.legResults = legResults;

            // status por perna (múltipla usa o match correto de cada jogo)
            if (totalLegs > 0 && (score1 != null || score2 != null || legResults)) {
              const statuses: TipStatus[] = isMult && legResults
                ? Array.from(
                    { length: totalLegs },
                    (_, i) => legResults?.[i]?.status ?? t.legStatuses?.[i] ?? "aguardando",
                  )
                : legs.map((leg) => {
                    const g = gradeSinglePalpite(leg, m, t);
                    if (g) return g;
                    return m.live ? "ao_vivo" : "aguardando";
                  });
              const prev = t.legStatuses ?? [];
              const same =
                prev.length === statuses.length && prev.every((s, i) => s === statuses[i]);
              if (!same) patch.legStatuses = statuses;

              if (isMult) {
                const nextStatus = resolveTicketStatus(statuses);
                if (t.status !== nextStatus) patch.status = nextStatus;
              }
            }

            if (isMult && Object.keys(patch).length > 1) {
              changed = true;
              return { ...t, ...patch };
            }

            if (t.status === "green" || t.status === "red") {
              if (Object.keys(patch).length > 1) changed = true;
              return Object.keys(patch).length > 1 ? { ...t, ...patch } : t;
            }
            const graded = gradePalpite(t.palpite, m, t);
            if (graded) {
              changed = true;
              return { ...t, ...patch, status: graded };
            }
            const hasLiveLegOverall =
              isMult && legResults
                ? Object.values(legResults).some((leg) => leg.live && !leg.finished)
                : false;
            const someLive = m.live || hasLiveLegOverall;
            if (someLive && t.status !== "ao_vivo") {
              changed = true;
              return { ...t, ...patch, status: "ao_vivo" as TipStatus };
            }
            if (!someLive && m.finished && t.status === "ao_vivo") {
              changed = true;
              return { ...t, ...patch, status: "aguardando" as TipStatus };
            }
            if (!someLive && !m.live && !m.finished && t.status !== "aguardando") {
              changed = true;
              return { ...t, ...patch, status: "aguardando" as TipStatus };
            }
            if (Object.keys(patch).length > 1) changed = true;
            return Object.keys(patch).length > 1 ? { ...t, ...patch } : t;
          }
          if (legChanged && legResults) {
            changed = true;
            const statuses: TipStatus[] = Array.from(
              { length: totalLegs },
              (_, i) => legResults?.[i]?.status ?? t.legStatuses?.[i] ?? "aguardando",
            );
            const nextStatus = resolveTicketStatus(statuses);
            return {
              ...t,
              type: isMult ? "Múltipla" : t.type,
              entradas: isMult ? Math.max(t.entradas ?? 1, totalLegs, 2) : t.entradas,
              status: nextStatus,
              legResults,
              legStatuses: statuses,
              resultCheckedAtMs: Date.now(),
            };
          }
          // sem match no feed: não mantém "ao vivo" sem confirmação real do provedor.
          if (t.status === "ao_vivo") {
            changed = true;
            return { ...t, status: "aguardando" as TipStatus, resultCheckedAtMs: Date.now() };
          }
          return t;
        });
        return changed ? next : prev;
      });
      setLastCheckMs(Date.now());
    } catch {
      // silencioso
    } finally {
      setRefreshing(false);
    }
  };

  // Polling automático
  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      if (!cancelled) void runCheck();
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketList.length]);


  const [tab, setTab] = useState<Tab>("todos");
  const [query, setQuery] = useState("");
  const [esporte, setEsporte] = useState("todos");
  const [tipo, setTipo] = useState("todos");
  const [modalOpen, setModalOpen] = useState(false);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const detailsTicket = detailsId ? ticketList.find((t) => t.id === detailsId) ?? null : null;

  const updateStatus = (id: string, status: TipStatus) =>
    setTickets((prev) => (Array.isArray(prev) ? prev : []).map((t) => (t.id === id ? { ...t, status } : t)));
  const removeTicket = (id: string) => {
    setTickets((prev) => (Array.isArray(prev) ? prev : []).filter((t) => t.id !== id));
    setDetailsId(null);
    void import("@/lib/tickets-store").then((m) => m.deleteTicket(id));
  };

  const counts = useMemo(() => {
    return {
      aguardando: ticketList.filter((t) => t.status === "aguardando").length,
      ao_vivo: ticketList.filter((t) => t.status === "ao_vivo").length,
      green: ticketList.filter((t) => t.status === "green").length,
      red: ticketList.filter((t) => t.status === "red").length,
    };
  }, [ticketList]);


  const filtered = useMemo(() => {
    return ticketList.filter((t) => {
      if (tab !== "todos" && t.status !== tab) return false;
      if (tipo !== "todos" && t.type.toLowerCase() !== tipo) return false;
      if (esporte !== "todos" && t.esporte.toLowerCase() !== esporte) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        if (
          !t.event.toLowerCase().includes(q) &&
          !t.league.toLowerCase().includes(q) &&
          !t.palpite.toLowerCase().includes(q) &&
          !t.id.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [ticketList, tab, tipo, esporte, query]);

  const addTicket = (t: Ticket) => setTickets((prev) => [t, ...(Array.isArray(prev) ? prev : [])]);

  return (
    <div className="space-y-4">
      {/* Topo */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Tickets de Tips</h2>
          <p className={`text-xs ${muted} mt-0.5 flex items-center gap-2 flex-wrap`}>
            <span>{ticketList.length} tickets no total</span>
            <span>·</span>
            <span className="inline-flex items-center gap-1 text-emerald-500">
              <Radio className="h-3 w-3" /> Tempo real ativo
            </span>
            {lastCheckMs && (
              <>
                <span>·</span>
                <span>Última busca {new Date(lastCheckMs).toLocaleTimeString("pt-BR")}</span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void runCheck()}
            disabled={refreshing}
            className={
              "h-10 px-4 rounded-md border text-sm font-medium inline-flex items-center gap-2 transition-colors disabled:opacity-60 " +
              (isDark
                ? "border-neutral-800 bg-neutral-900 text-neutral-200 hover:bg-neutral-800"
                : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50")
            }
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Buscando..." : "Buscar resultados"}
          </button>
          <button
            onClick={() => setModalOpen(true)}
            style={{
              backgroundImage:
                "linear-gradient(90deg, #0f5f2a 0%, #1f8a3a 55%, #54ee2b 100%)",
            }}
            className="h-10 px-4 rounded-md text-white text-sm font-semibold inline-flex items-center gap-2 hover:brightness-110 active:brightness-95 shadow-sm"
          >
            <Plus className="h-4 w-4" /> Novo Ticket
          </button>
        </div>
      </div>

      {/* Tabs de status */}
      <div className="flex flex-wrap gap-2">
        <StatusTab
          active={tab === "aguardando"}
          onClick={() => setTab(tab === "aguardando" ? "todos" : "aguardando")}
          color="sky"
          isDark={isDark}
        >
          <Calendar className="h-3.5 w-3.5" /> Em Aguardo ({counts.aguardando})
        </StatusTab>
        <StatusTab
          active={tab === "ao_vivo"}
          onClick={() => setTab(tab === "ao_vivo" ? "todos" : "ao_vivo")}
          color="amber"
          isDark={isDark}
        >
          <Radio className="h-3.5 w-3.5" /> Ao Vivo ({counts.ao_vivo})
        </StatusTab>
        <StatusTab
          active={tab === "green"}
          onClick={() => setTab(tab === "green" ? "todos" : "green")}
          color="emerald"
          isDark={isDark}
        >
          <TrendingUp className="h-3.5 w-3.5" /> Green ({counts.green})
        </StatusTab>
        <StatusTab
          active={tab === "red"}
          onClick={() => setTab(tab === "red" ? "todos" : "red")}
          color="red"
          isDark={isDark}
        >
          <TrendingUp className="h-3.5 w-3.5 rotate-180" /> Red ({counts.red})
        </StatusTab>
      </div>

      {/* Filtros */}
      <div className={`rounded-xl border p-4 ${panel}`}>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-3">
          <div className="relative">
            <Search
              className={
                "absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 " +
                (isDark ? "text-neutral-500" : "text-neutral-400")
              }
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar tickets, partidas, palpites..."
              className={inputCls}
            />
          </div>
          <select
            value={esporte}
            onChange={(e) => setEsporte(e.target.value)}
            className={selectCls}
          >
            <option value="todos">Todos os Esportes</option>
            <option value="futebol">Futebol</option>
            <option value="basquete">Basquete</option>
            <option value="tenis">Tênis</option>
          </select>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className={selectCls}
          >
            <option value="todos">Todos os Tipos</option>
            <option value="simples">Simples</option>
            <option value="múltipla">Múltipla</option>
          </select>
        </div>
      </div>

      {/* Grid de tickets */}
      {filtered.length === 0 ? (
        <div
          className={`rounded-xl border p-12 text-center ${panel} ${muted}`}
        >
          Nenhum ticket encontrado com esses filtros.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((t) => (
            <TicketCard
              key={t.id}
              ticket={t}
              live={liveMap[t.id]}
              isDark={isDark}
              subtle={subtle}
              muted={muted}
              onOpen={() => setDetailsId(t.id)}
            />
          ))}
        </div>
      )}



      {modalOpen && (
        <NovoTicketModal
          isDark={isDark}
          onClose={() => setModalOpen(false)}
          onCreate={(t) => {
            addTicket(t);
            setModalOpen(false);
          }}
        />
      )}

      {detailsTicket && (
        <DetailsModal
          isDark={isDark}
          ticket={detailsTicket}
          onClose={() => setDetailsId(null)}
          onStatus={(s) => updateStatus(detailsTicket.id, s)}
          onDelete={() => removeTicket(detailsTicket.id)}
        />
      )}
    </div>
  );
}

function StatusTab({
  active,
  onClick,
  color,
  isDark,
  children,
}: {
  active: boolean;
  onClick: () => void;
  color: "amber" | "emerald" | "red" | "sky";
  isDark: boolean;
  children: React.ReactNode;
}) {
  const palette = LIVE_PALETTE[color];

  return (
    <button
      onClick={onClick}
      className={
        "inline-flex items-center gap-1.5 h-9 px-3 rounded-full border text-xs font-semibold transition " +
        palette.base +
        " " +
        (active ? palette.activeRing : "opacity-90 hover:opacity-100") +
        " " +
        (isDark ? "" : "")
      }
    >
      {children}
    </button>
  );
}

function TicketCard({
  ticket,
  live,
  isDark,
  subtle,
  muted,
  onOpen,
}: {
  ticket: Ticket;
  live?: LiveState;
  isDark: boolean;
  subtle: string;
  muted: string;
  onOpen: () => void;
}) {
  const card = isDark
    ? "bg-neutral-900 border-neutral-800"
    : "bg-white border-neutral-200";
  const inner = isDark ? "bg-neutral-950/60 border-neutral-800" : "bg-neutral-50 border-neutral-200";
  const divider = isDark ? "border-neutral-800" : "border-neutral-200";
  const accent =
    ticket.status === "green"
      ? "from-emerald-500/80 to-emerald-500/0"
      : ticket.status === "red"
        ? "from-red-500/80 to-red-500/0"
        : ticket.status === "aguardando"
          ? "from-sky-500/80 to-sky-500/0"
          : "from-amber-500/80 to-amber-500/0";
  const parceiroTag =
    ticket.parceiro === "seubet"
      ? { label: "SeuBet", cls: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" }
      : ticket.parceiro === "h2bet"
        ? { label: "H2Bet", cls: "bg-red-500/15 text-red-500 border-red-500/30" }
        : null;

  const palpites = splitPalpites(ticket.palpite);
  const eventGames = extractMultiGames(ticket.event);
  const isMultipla = isMultiplaTicket(ticket) || eventGames.length > 1;
  const parts = ticket.event.split(/\s+(?:vs|x|×|-)\s+/i);
  const team1 = (parts[0] ?? ticket.event).trim();
  const team2 = (parts[1] ?? "").trim();
  const isLive = !!live?.live && !live.finished && ticket.status !== "green" && ticket.status !== "red";
  const score1 = live?.score1 ?? ticket.score1;
  const score2 = live?.score2 ?? ticket.score2;
  const team1Logo = teamLogoUrl(live?.team1Logo ?? ticket.team1Logo, live?.team1Id, team1);
  const team2Logo = teamLogoUrl(live?.team2Logo ?? ticket.team2Logo, live?.team2Id, team2);
  const showScore = score1 != null || score2 != null;

  // Para múltipla: extrai os jogos do event ("Múltipla: A x B + C x D")
  const multiGames = isMultipla ? eventGames : [];

  return (
    <button
      onClick={onOpen}
      className={
        `group relative text-left rounded-2xl border ${card} p-5 flex flex-col gap-4 ` +
        `transition-all hover:-translate-y-0.5 hover:shadow-lg overflow-hidden ` +
        (isDark ? "hover:border-neutral-700" : "hover:border-neutral-300")
      }
    >
      <div
        aria-hidden
        className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${accent}`}
      />

      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <StatusPill status={ticket.status} />
          <span
            className={
              "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border " +
              (isDark
                ? "border-neutral-700 text-neutral-300 bg-neutral-800/50"
                : "border-neutral-200 text-neutral-600 bg-neutral-100")
            }
          >
            {isMultipla ? "Múltipla" : ticket.type}
          </span>
          {parceiroTag && (
            <span
              className={
                "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border " +
                parceiroTag.cls
              }
            >
              {parceiroTag.label}
            </span>
          )}
        </div>
        <div className={`text-[10px] font-mono tracking-wider shrink-0 ${subtle}`}>
          #{ticket.id}
        </div>
      </div>

      {/* Título — nome do jogo (ou "Múltipla") sempre visível */}
      <div>
        <div className="text-sm font-semibold leading-tight break-words">
          {ticket.event}
        </div>
        {ticket.league && (
          <div className={`text-[11px] mt-0.5 truncate ${muted}`}>{ticket.league}</div>
        )}
      </div>

      {/* Matchup: só para Simples (múltipla tem times diferentes por perna) */}
      {!isMultipla && (
        <div className={`rounded-xl border ${inner} px-3 py-3`}>
          <div className="flex items-center justify-between gap-3">
            <TeamBadge name={team1} logo={team1Logo} isDark={isDark} align="left" />
            <div className="flex flex-col items-center min-w-[60px]">
              {showScore ? (
                <div className="text-xl font-bold leading-none tabular-nums">
                  <span className="text-emerald-500">{score1 ?? 0}</span>
                  <span className={`mx-1 ${muted}`}>-</span>
                  <span className="text-emerald-500">{score2 ?? 0}</span>
                </div>
              ) : (
                <div className={`text-xs font-semibold ${muted}`}>VS</div>
              )}
              {isLive && (
                <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-amber-500">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500" />
                  </span>
                  {live?.minute ? `${live.minute}'` : "AO VIVO"}
                </div>
              )}
            </div>
            <TeamBadge name={team2 || "—"} logo={team2Logo} isDark={isDark} align="right" />
          </div>
        </div>
      )}

      {/* Múltipla: sub-cards por jogo dentro do mesmo ticket */}
      {isMultipla && multiGames.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className={`text-[10px] uppercase tracking-wider ${subtle}`}>
            Jogos ({multiGames.length})
          </div>
          <div className="grid grid-cols-1 gap-2">
            {multiGames.map((g, i) => {
              const legInfo = live?.legs?.[i] ?? ticket.legResults?.[i];
              const displayTeam1 = g.team1 || legInfo?.team1 || "Time 1";
              const displayTeam2 = g.team2 || legInfo?.team2 || "Time 2";
              const gLogo1 = teamLogoUrl(legInfo?.team1Logo, legInfo?.team1Id, displayTeam1);
              const gLogo2 = teamLogoUrl(legInfo?.team2Logo, legInfo?.team2Id, displayTeam2);
              const gLive = legInfo?.live && !legInfo?.finished;
              const fallbackScore1 = i === 0 ? ticket.score1 : null;
              const fallbackScore2 = i === 0 ? ticket.score2 : null;
              const displayScore1 = legInfo?.score1 ?? fallbackScore1;
              const displayScore2 = legInfo?.score2 ?? fallbackScore2;
              const gScore = displayScore1 != null || displayScore2 != null;
              return (
                <div
                  key={i}
                  className={`rounded-lg border ${inner} px-3 py-2 flex items-center justify-between gap-2`}
                >
                  <TeamBadge
                    name={displayTeam1}
                    logo={gLogo1}
                    isDark={isDark}
                    align="left"
                  />
                  <div className="flex flex-col items-center min-w-[52px]">
                    {gScore ? (
                      <div className="text-sm font-bold leading-none tabular-nums text-emerald-500">
                        {displayScore1 ?? 0}
                        <span className={`mx-1 ${muted}`}>-</span>
                        {displayScore2 ?? 0}
                      </div>
                    ) : (
                      <div className={`text-[10px] font-semibold ${muted}`}>VS</div>
                    )}
                    {gLive && (
                      <div className="mt-0.5 inline-flex items-center gap-1 text-[9px] font-semibold text-amber-500">
                        <span className="h-1 w-1 rounded-full bg-amber-500 animate-pulse" />
                        {legInfo?.minute ? `${legInfo.minute}'` : "AO VIVO"}
                      </div>
                    )}
                  </div>
                  <TeamBadge
                    name={displayTeam2}
                    logo={gLogo2}
                    isDark={isDark}
                    align="right"
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}


      {/* Palpites (lista) com status por perna */}
      <div className={`rounded-xl border ${inner} p-3`}>
        <div className={`text-[10px] uppercase tracking-wider ${subtle} mb-2`}>
          {palpites.length > 1 ? `Palpites (${palpites.length})` : "Palpite"}
        </div>
        <ul className="flex flex-col gap-1.5">
          {palpites.map((p, i) => {
            const matchedGameStatus = isMultipla ? ticket.legResults?.[i]?.status : undefined;
            const legStatus = matchedGameStatus ?? ticket.legStatuses?.[i];
            const dotCls =
              legStatus === "green"
                ? "bg-emerald-500"
                : legStatus === "red"
                  ? "bg-red-500"
                  : legStatus === "ao_vivo"
                    ? "bg-amber-500 animate-pulse"
                    : "bg-neutral-500/60";
            const legLabel =
              legStatus === "green"
                ? "Green"
                : legStatus === "red"
                  ? "Red"
                  : legStatus === "ao_vivo"
                    ? "Ao vivo"
                    : "Aguardando";
            const legLabelCls =
              legStatus === "green"
                ? "text-emerald-500"
                : legStatus === "red"
                  ? "text-red-500"
                  : legStatus === "ao_vivo"
                    ? "text-amber-500"
                    : muted;
            return (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${dotCls}`} />
                <span className="font-medium break-words leading-snug flex-1 min-w-0">{p}</span>
                <span className={`text-[10px] font-semibold uppercase tracking-wider shrink-0 mt-0.5 ${legLabelCls}`}>
                  {legLabel}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Odd + Banca em destaque */}
      <div className="grid grid-cols-2 gap-3">
        <div
          className={
            "rounded-xl border px-3 py-3 " +
            (isDark
              ? "bg-emerald-500/5 border-emerald-500/20"
              : "bg-emerald-50 border-emerald-100")
          }
        >
          <div className={`text-[10px] uppercase tracking-wider ${subtle}`}>Odd</div>
          <div className="text-xl font-bold text-emerald-500 mt-1 leading-none">
            {ticket.odd.toFixed(2)}
          </div>
        </div>
        <div className={`rounded-xl border ${inner} px-3 py-3`}>
          <div className={`text-[10px] uppercase tracking-wider ${subtle}`}>Banca</div>
          <div className="text-xl font-bold mt-1 leading-none">
            {ticket.banca.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Footer meta */}
      <div className={`flex items-center justify-between text-[11px] pt-3 border-t ${divider} ${muted}`}>
        <span className="inline-flex items-center gap-1.5 truncate">
          <Calendar className="h-3.5 w-3.5 shrink-0" />
          {ticket.startMs
            ? new Date(ticket.startMs).toLocaleString("pt-BR", {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })
            : ticket.date}
        </span>
        <span className="inline-flex items-center gap-1 font-medium text-emerald-500 opacity-70 group-hover:opacity-100 transition-opacity">
          Ver detalhes <Eye className="h-3.5 w-3.5" />
        </span>
      </div>
    </button>
  );
}

function LegCard({
  ticket,
  legIndex,
  legText,
  legTotal,
  legLive,
  legStatus,
  isDark,
  subtle,
  muted,
  onOpen,
}: {
  ticket: Ticket;
  legIndex: number;
  legText: string;
  legTotal: number;
  legLive?: LegLive;
  legStatus: TipStatus;
  isDark: boolean;
  subtle: string;
  muted: string;
  onOpen: () => void;
}) {
  const card = isDark ? "bg-neutral-900 border-neutral-800" : "bg-white border-neutral-200";
  const inner = isDark ? "bg-neutral-950/60 border-neutral-800" : "bg-neutral-50 border-neutral-200";
  const divider = isDark ? "border-neutral-800" : "border-neutral-200";
  const accent =
    legStatus === "green"
      ? "from-emerald-500/80 to-emerald-500/0"
      : legStatus === "red"
        ? "from-red-500/80 to-red-500/0"
        : legStatus === "ao_vivo"
          ? "from-amber-500/80 to-amber-500/0"
          : "from-sky-500/80 to-sky-500/0";
  const parceiroTag =
    ticket.parceiro === "seubet"
      ? { label: "SeuBet", cls: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" }
      : ticket.parceiro === "h2bet"
        ? { label: "H2Bet", cls: "bg-red-500/15 text-red-500 border-red-500/30" }
        : null;

  const team1 = legLive?.team1 ?? "Time 1";
  const team2 = legLive?.team2 ?? "Time 2";
  const team1Logo =
    legLive?.team1Logo || (legLive?.team1Id ? `/api/public/team-image/${legLive.team1Id}?type=team` : undefined);
  const team2Logo =
    legLive?.team2Logo || (legLive?.team2Id ? `/api/public/team-image/${legLive.team2Id}?type=team` : undefined);
  const isLive = legLive?.live && !legLive?.finished;
  const showScore = legLive?.score1 != null || legLive?.score2 != null;
  const eventTitle = legLive ? `${team1} × ${team2}` : "Jogo não identificado";

  return (
    <button
      onClick={onOpen}
      className={
        `group relative text-left rounded-2xl border ${card} p-5 flex flex-col gap-4 ` +
        `transition-all hover:-translate-y-0.5 hover:shadow-lg overflow-hidden ` +
        (isDark ? "hover:border-neutral-700" : "hover:border-neutral-300")
      }
    >
      <div aria-hidden className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${accent}`} />

      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <StatusPill status={legStatus} />
          <span
            className={
              "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border " +
              (isDark
                ? "border-purple-500/30 text-purple-400 bg-purple-500/10"
                : "border-purple-300 text-purple-700 bg-purple-50")
            }
          >
            Múltipla · {legIndex + 1}/{legTotal}
          </span>
          {parceiroTag && (
            <span
              className={
                "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border " +
                parceiroTag.cls
              }
            >
              {parceiroTag.label}
            </span>
          )}
        </div>
        <div className={`text-[10px] font-mono tracking-wider shrink-0 ${subtle}`}>
          #{ticket.id}
        </div>
      </div>

      {/* Título do jogo */}
      <div>
        <div className="text-sm font-semibold leading-tight break-words">{eventTitle}</div>
        {ticket.league && (
          <div className={`text-[11px] mt-0.5 truncate ${muted}`}>{ticket.league}</div>
        )}
      </div>

      {/* Matchup */}
      <div className={`rounded-xl border ${inner} px-3 py-3`}>
        <div className="flex items-center justify-between gap-3">
          <TeamBadge name={team1} logo={team1Logo} isDark={isDark} align="left" />
          <div className="flex flex-col items-center min-w-[60px]">
            {showScore ? (
              <div className="text-xl font-bold leading-none tabular-nums">
                <span className="text-emerald-500">{legLive?.score1 ?? 0}</span>
                <span className={`mx-1 ${muted}`}>-</span>
                <span className="text-emerald-500">{legLive?.score2 ?? 0}</span>
              </div>
            ) : (
              <div className={`text-xs font-semibold ${muted}`}>VS</div>
            )}
            {isLive && (
              <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-amber-500">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500" />
                </span>
                {legLive?.minute ? `${legLive.minute}'` : "AO VIVO"}
              </div>
            )}
          </div>
          <TeamBadge name={team2} logo={team2Logo} isDark={isDark} align="right" />
        </div>
      </div>

      {/* Palpite desta perna */}
      <div className={`rounded-xl border ${inner} p-3`}>
        <div className={`text-[10px] uppercase tracking-wider ${subtle} mb-1.5`}>Palpite</div>
        <div className="text-sm font-medium break-words leading-snug">{legText}</div>
      </div>

      {/* Odd e banca (ticket-level) */}
      <div className="grid grid-cols-2 gap-3">
        <div
          className={
            "rounded-xl border px-3 py-3 " +
            (isDark ? "bg-emerald-500/5 border-emerald-500/20" : "bg-emerald-50 border-emerald-100")
          }
        >
          <div className={`text-[10px] uppercase tracking-wider ${subtle}`}>Odd Múltipla</div>
          <div className="text-xl font-bold text-emerald-500 mt-1 leading-none">
            {ticket.odd.toFixed(2)}
          </div>
        </div>
        <div className={`rounded-xl border ${inner} px-3 py-3`}>
          <div className={`text-[10px] uppercase tracking-wider ${subtle}`}>Banca</div>
          <div className="text-xl font-bold mt-1 leading-none">{ticket.banca.toFixed(1)}%</div>
        </div>
      </div>

      <div className={`flex items-center justify-between text-[11px] pt-3 border-t ${divider} ${muted}`}>
        <span className="inline-flex items-center gap-1.5 truncate">
          <Calendar className="h-3.5 w-3.5 shrink-0" />
          {ticket.date}
        </span>
        <span className="inline-flex items-center gap-1 font-medium text-emerald-500 opacity-70 group-hover:opacity-100 transition-opacity">
          Ver ticket <Eye className="h-3.5 w-3.5" />
        </span>
      </div>
    </button>
  );
}

function isMultiplaTicket(ticket: Ticket): boolean {
  return (
    ticket.type === "Múltipla" ||
    (ticket.entradas ?? 0) > 1 ||
    /m[uú]ltipla|multipla/i.test(ticket.event)
  );
}

function extractMultiGames(event: string): MultiGame[] {
  return String(event ?? "")
    .replace(/^\s*(m[uú]ltipla\s*[:\-]?\s*)/i, "")
    .split(/\s*\+\s*/)
    .map((seg) => {
      const p = seg.split(/\s+(?:vs|x|×)\s+/i);
      return {
        team1: (p[0] ?? seg).trim(),
        team2: (p[1] ?? "").trim(),
      };
    })
    .filter((g) => g.team1 && g.team2);
}

function gameForLeg(index: number, totalLegs: number, games: MultiGame[]): MultiGame | undefined {
  if (!Array.isArray(games) || games.length === 0) return undefined;
  if (games[index]) return games[index];
  if (games.length < totalLegs) return games[games.length - 1];
  return undefined;
}

function ticketForLeg(ticket: Ticket, game?: MultiGame): Ticket {
  if (!game) return ticket;
  return { ...ticket, event: `${game.team1} x ${game.team2}`, type: "Simples", entradas: 1 };
}

function shouldForceClose(ticket: Ticket): boolean {
  const baseMs = ticket.startMs ?? ticket.createdAtMs ?? null;
  return typeof baseMs === "number" && Number.isFinite(baseMs) && Date.now() - baseMs > MATCH_AUTO_CLOSE_MS;
}

function closeExpiredMatch(ticket: Ticket, match: LiveMatch): LiveMatch {
  if (!match.live || match.finished || !shouldForceClose(ticket)) return match;
  return {
    ...match,
    status: /^(ft|finished|ended)$/i.test(match.status || "") ? match.status : "FT",
    minute: undefined,
    live: false,
    finished: true,
  };
}

function legResultToFinishedMatch(
  leg: TicketLegResult | undefined,
  game: MultiGame | undefined,
  index: number,
  ticket: Ticket,
): LiveMatch | null {
  if (!leg) return null;
  const hasScore = leg.score1 != null || leg.score2 != null;
  if (!hasScore && !leg.live && !leg.finished) return null;
  const forceFinished = shouldForceClose(ticket) || !!leg.finished;
  if (!forceFinished && !leg.live) return null;
  return {
    id: leg.matchId || `cached-leg-${ticket.id}-${index}`,
    status: forceFinished ? "FT" : "LIVE",
    team1: leg.team1 || game?.team1 || "Time 1",
    team2: leg.team2 || game?.team2 || "Time 2",
    team1Logo: leg.team1Logo,
    team2Logo: leg.team2Logo,
    team1Id: leg.team1Id,
    team2Id: leg.team2Id,
    score1: leg.score1 ?? null,
    score2: leg.score2 ?? null,
    minute: forceFinished ? undefined : leg.minute,
    live: forceFinished ? false : !!leg.live,
    finished: forceFinished,
  };
}

function preservedFinishedStatus(previous: TipStatus | undefined, match: LiveMatch): TipStatus {
  if (previous === "green" || previous === "red") return previous;
  if (match.live && !match.finished) return "ao_vivo";
  return match.finished ? "aguardando" : "aguardando";
}

function resolveTicketStatus(statuses: TipStatus[]): TipStatus {
  const safe = Array.isArray(statuses) ? statuses : [];
  if (safe.some((status) => status === "red")) return "red";
  if (safe.length > 0 && safe.every((status) => status === "green")) return "green";
  if (safe.some((status) => status === "ao_vivo")) return "ao_vivo";
  return "aguardando";
}

function teamLogoUrl(logo?: string, teamId?: string, teamName?: string): string | undefined {
  if (typeof logo === "string" && logo.trim()) {
    const url = logo.trim();
    setCachedLogo(teamName, url);
    return url;
  }
  const cached = getCachedLogo(teamName);
  if (cached) return cached;
  const emoji = teamName ? FLAG_LOGOS[normalizedText(teamName)] : undefined;
  if (emoji) {
    return `data:image/svg+xml;utf8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" rx="48" fill="#111827"/><text x="48" y="58" text-anchor="middle" font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif" font-size="54">${emoji}</text></svg>`,
    )}`;
  }
  if (teamId) return `/api/public/team-image/${encodeURIComponent(teamId)}?type=team`;
  return undefined;
}

function payloadToLiveMatches(payload?: MatchLogoPayload): LiveMatch[] {
  const leagues = Array.isArray(payload?.leagues) ? payload.leagues : [];
  if (!leagues.length) return [];
  return leagues.flatMap((league) =>
    (Array.isArray(league.matches) ? league.matches : []).map((match) => normalizedMatchToLiveMatch(match)),
  );
}

function safeStr(v: unknown): string | undefined {
  if (v == null) return undefined;
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return undefined;
}

function normalizedMatchToLiveMatch(match: MatchLogoSource): LiveMatch {
  const status = safeStr(match.status) ?? "";
  return {
    id: match.id,
    status,
    team1: safeStr(match.home?.name) ?? "",
    team2: safeStr(match.away?.name) ?? "",
    team1Logo: safeStr(match.home?.image),
    team2Logo: safeStr(match.away?.image),
    team1Id: match.home?.id,
    team2Id: match.away?.id,
    score1: match.home?.goals,
    score2: match.away?.goals,
    minute: match.live ? status : undefined,
    live: match.live,
    finished: match.finished,
  };
}

function mergeLiveMatches(baseMatches: LiveMatch[], liveMatches: LiveMatch[]): LiveMatch[] {
  const byKey = new Map<string, LiveMatch>();
  const add = (match: LiveMatch, preferLive: boolean) => {
    const key = `${normalizedText(match.team1)}::${normalizedText(match.team2)}`;
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, match);
      return;
    }
    byKey.set(key, {
      ...prev,
      ...(preferLive ? match : {}),
      team1Logo: match.team1Logo ?? prev.team1Logo,
      team2Logo: match.team2Logo ?? prev.team2Logo,
      team1Id: match.team1Id ?? prev.team1Id,
      team2Id: match.team2Id ?? prev.team2Id,
      score1: match.score1 ?? prev.score1,
      score2: match.score2 ?? prev.score2,
      live: preferLive ? match.live : prev.live,
      finished: preferLive ? match.finished : prev.finished,
      status: preferLive ? match.status : prev.status,
      minute: match.minute ?? prev.minute,
    });
  };
  baseMatches.forEach((match) => add(match, false));
  liveMatches.forEach((match) => add(match, true));
  return Array.from(byKey.values());
}

function splitPalpites(raw: string): string[] {
  if (!raw) return ["—"];
  // Separadores fortes e inequívocos entre pernas de uma múltipla.
  // OBS: NÃO usamos " — " (em-dash) porque ele aparece DENTRO do nome do
  // mercado, ex.: "Total de gols no jogo — Mais de (1.5)".
  const normalized = raw
    // numeração inicial tipo "1) ", "2. " vira quebra de linha
    .replace(/(?:^|\s)(?:\d+\s*[\)\.\-:]\s+)/g, "\n")
    .replace(/\s+•\s+/g, "\n");
  const parts = normalized
    .split(/\r?\n|;| \/ | \| | · /g)
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length ? parts : [raw.trim()];
}

function tokensOf(s: string): string[] {
  return normalizedText(s)
    .split(" ")
    .filter((t) => t.length >= 3 && !["multipla", "simples", "vitoria", "vencedor", "gols", "mais", "menos", "over", "under", "total", "empate", "casa", "fora"].includes(t));
}

function findMatchForLeg(legText: string, matches: LiveMatch[], game?: MultiGame): { match: LiveMatch; swapped: boolean } | null {
  const source = game ? `${game.team1} ${game.team2} ${legText}` : legText;
  const tks = new Set(tokensOf(source));
  const g1 = game ? new Set(tokensOf(game.team1)) : null;
  const g2 = game ? new Set(tokensOf(game.team2)) : null;
  if (!tks.size) return null;
  let best: { match: LiveMatch; score: number; swapped: boolean } | null = null;
  for (const m of matches) {
    const t1 = tokensOf(m.team1);
    const t2 = tokensOf(m.team2);
    const hit1 = t1.some((t) => tks.has(t));
    const hit2 = t2.some((t) => tks.has(t));
    const gameHit1 = g1 ? t1.some((t) => g1.has(t)) || t2.some((t) => g1.has(t)) : false;
    const gameHit2 = g2 ? t1.some((t) => g2.has(t)) || t2.some((t) => g2.has(t)) : false;
    // requer sinal de pelo menos um dos times; ideal os dois
    if (!hit1 && !hit2 && !gameHit1 && !gameHit2) continue;
    const score = (hit1 ? 2 : 0) + (hit2 ? 2 : 0) + (gameHit1 ? 3 : 0) + (gameHit2 ? 3 : 0);
    if (!best || score > best.score) best = { match: m, score, swapped: false };
  }
  return best ? { match: best.match, swapped: best.swapped } : null;
}

function normalizedText(input: unknown): string {
  const s = typeof input === "string" ? input : input == null ? "" : String(input);
  const base = s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return base
    .replace(/\begito\b/g, "egypt")
    .replace(/\bestados unidos\b|\beua\b/g, "usa")
    .replace(/\bbelgica\b/g, "belgium")
    .replace(/\balemanha\b/g, "germany")
    .replace(/\bespanha\b/g, "spain")
    .replace(/\bfranca\b/g, "france")
    .replace(/\binglaterra\b/g, "england")
    .replace(/\bescocia\b/g, "scotland")
    .replace(/\bpais de gales\b|\bgales\b/g, "wales")
    .replace(/\birlanda\b/g, "ireland")
    .replace(/\bitalia\b/g, "italy")
    .replace(/\bholanda\b|\bpaises baixos\b/g, "netherlands")
    .replace(/\bsuica\b/g, "switzerland")
    .replace(/\baustria\b/g, "austria")
    .replace(/\bpolonia\b/g, "poland")
    .replace(/\bdinamarca\b/g, "denmark")
    .replace(/\bsuecia\b/g, "sweden")
    .replace(/\bnoruega\b/g, "norway")
    .replace(/\bfinlandia\b/g, "finland")
    .replace(/\bcroacia\b/g, "croatia")
    .replace(/\bservia\b|\bservia\b/g, "serbia")
    .replace(/\bgrecia\b/g, "greece")
    .replace(/\bturquia\b/g, "turkey")
    .replace(/\brussia\b/g, "russia")
    .replace(/\bucrania\b/g, "ukraine")
    .replace(/\brepublica tcheca\b|\btcheca\b/g, "czech")
    .replace(/\beslovaquia\b/g, "slovakia")
    .replace(/\bhungria\b/g, "hungary")
    .replace(/\bromenia\b/g, "romania")
    .replace(/\bbulgaria\b/g, "bulgaria")
    .replace(/\bmarrocos\b/g, "morocco")
    .replace(/\btunisia\b/g, "tunisia")
    .replace(/\bargelia\b/g, "algeria")
    .replace(/\bnigeria\b/g, "nigeria")
    .replace(/\bcamaroes\b/g, "cameroon")
    .replace(/\bcosta do marfim\b/g, "ivory coast")
    .replace(/\bafrica do sul\b/g, "south africa")
    .replace(/\bjapao\b/g, "japan")
    .replace(/\bcoreia do sul\b|\bcoreia\b/g, "south korea")
    .replace(/\bchina\b/g, "china")
    .replace(/\baustralia\b/g, "australia")
    .replace(/\barabia saudita\b/g, "saudi arabia")
    .replace(/\bcatar\b/g, "qatar")
    .replace(/\bira\b/g, "iran")
    .replace(/\biraque\b/g, "iraq")
    .replace(/\bemirados arabes\b|\bemirados\b/g, "uae")
    .replace(/\bmexico\b/g, "mexico")
    .replace(/\buruguai\b/g, "uruguay")
    .replace(/\bparaguai\b/g, "paraguay")
    .replace(/\bchile\b/g, "chile")
    .replace(/\bcolombia\b/g, "colombia")
    .replace(/\bequador\b/g, "ecuador")
    .replace(/\bbrasil\b/g, "brazil");
}

function isSwappedMatch(ticket: Ticket, feedHome: string, feedAway: string): boolean {
  const parts = ticket.event.split(/\s+(?:vs|x|×|-)\s+/i);
  const tHome = normalizedText(parts[0] ?? "");
  const tAway = normalizedText(parts[1] ?? "");
  const home = normalizedText(feedHome);
  const away = normalizedText(feedAway);
  if (!tHome || !tAway) return false;
  return away.includes(tHome) || tAway.includes(home);
}


function Stat({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted: string;
}) {
  return (
    <div>
      <div className={`text-[10px] uppercase tracking-wider ${muted}`}>{label}</div>
      <div className="text-sm font-semibold mt-0.5">{value}</div>
    </div>
  );
}

function StatusPill({ status }: { status: TipStatus }) {
  if (status === "aguardando") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold bg-sky-500/15 text-sky-500 border border-sky-500/30">
        <Calendar className="h-3 w-3" /> Em Aguardo
      </span>
    );
  }
  if (status === "ao_vivo") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold bg-amber-500/15 text-amber-500 border border-amber-500/30">
        <Radio className="h-3 w-3" /> Ao Vivo
      </span>
    );
  }
  if (status === "green") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
        <TrendingUp className="h-3 w-3" /> Green
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold bg-red-500/15 text-red-500 border border-red-500/30">
      <TrendingUp className="h-3 w-3 rotate-180" /> Red
    </span>
  );
}

function TeamBadge({
  name,
  logo,
  isDark,
  align,
}: {
  name: string;
  logo?: string;
  isDark: boolean;
  align: "left" | "right";
}) {
  const safeLogo = typeof logo === "string" && logo.trim() ? logo.trim() : undefined;
  const [brokenLogo, setBrokenLogo] = useState(false);
  useEffect(() => {
    setBrokenLogo(false);
  }, [safeLogo]);
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "?";
  const fallback = isDark
    ? "bg-neutral-800 text-neutral-300 border-neutral-700"
    : "bg-neutral-100 text-neutral-600 border-neutral-200";
  const flag = FLAG_LOGOS[normalizedText(name)];
  return (
    <div
      className={`flex-1 min-w-0 flex items-center gap-2 ${align === "right" ? "flex-row-reverse text-right" : ""}`}
    >
      {flag ? (
        <div
          className={`h-10 w-10 rounded-full border flex items-center justify-center shrink-0 ${fallback}`}
        >
          <span className="text-2xl leading-none">{flag}</span>
        </div>
      ) : safeLogo && !brokenLogo ? (
        <img
          src={safeLogo}
          alt={name}
          className="h-10 w-10 object-contain shrink-0"
          loading="lazy"
          onLoad={() => {
            if (!safeLogo.startsWith("data:")) setCachedLogo(name, safeLogo);
          }}
          onError={() => {
            markLogoBroken(name, safeLogo);
            setBrokenLogo(true);
          }}
        />
      ) : (
        <div
          className={`h-10 w-10 rounded-full border flex items-center justify-center text-[11px] font-bold shrink-0 ${fallback}`}
        >
          {initials}
        </div>
      )}
      <div className="min-w-0">
        <div className="text-sm font-semibold leading-tight truncate">{name}</div>
      </div>
    </div>
  );
}

function NovoTicketModal({
  isDark,
  onClose,
  onCreate,
}: {
  isDark: boolean;
  onClose: () => void;
  onCreate: (t: Ticket) => void;
}) {
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [parceiro, setParceiro] = useState<Parceiro>("seubet");
  const [url, setUrl] = useState("");
  const [dropOpen, setDropOpen] = useState(false);

  // manual fields
  const [event, setEvent] = useState("");
  const [league, setLeague] = useState("");
  const [palpite, setPalpite] = useState("");
  const [odd, setOdd] = useState("");
  const [banca, setBanca] = useState("10");
  const [esporte, setEsporte] = useState("Futebol");

  // auto lookup
  const [loading, setLoading] = useState(false);
  const [feedResult, setFeedResult] = useState<BetTipsResult | null>(null);
  const selected = feedResult && feedResult.ok ? feedResult.match : null;
  const sharedMeta = feedResult && !feedResult.ok ? feedResult.sharedMeta : undefined;
  const canCreateRecoveredShared = !!(sharedMeta && event.trim() && palpite.trim() && odd);

  const overlay =
    "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm";
  const box =
    "w-full max-w-2xl rounded-2xl border shadow-2xl " +
    (isDark
      ? "bg-neutral-900 border-neutral-800 text-neutral-100"
      : "bg-white border-neutral-200 text-neutral-900");
  const muted = isDark ? "text-neutral-400" : "text-neutral-500";
  const field =
    "h-10 w-full rounded-md border px-3 text-sm outline-none transition-colors " +
    (isDark
      ? "bg-neutral-950 border-neutral-800 text-neutral-100 focus:border-emerald-600"
      : "bg-white border-neutral-300 text-neutral-900 focus:border-emerald-700");

  const parceiroLabel = PARCEIROS.find((p) => p.value === parceiro)?.label ?? "";

  // Detecta parceiro pela URL e valida contra o selecionado
  const urlParceiro: Parceiro | null = (() => {
    const s = url.toLowerCase();
    if (!s.trim()) return null;
    if (s.includes("seu.bet") || s.includes("seubet")) return "seubet";
    if (s.includes("h2.bet") || s.includes("h2bet")) return "h2bet";
    return null;
  })();
  const urlMismatch = urlParceiro && urlParceiro !== parceiro;

  const buscarNoFeed = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setFeedResult(null);
    try {
      const r = await importBetTip(parceiro, url.trim());
      setFeedResult(r);
      // Se veio odd/mercado do WebSocket do parceiro, prepopula os campos
      if (r.ok) {
        if (r.odd != null && !odd) setOdd(String(r.odd));
        if (r.market && !palpite) setPalpite(r.market);
        if (r.parceiro !== parceiro) setParceiro(r.parceiro);
      } else if (r.sharedMeta) {
        if (r.sharedMeta.odd != null && !odd) setOdd(String(r.sharedMeta.odd));
        if (r.sharedMeta.amount != null && !banca) setBanca(String(r.sharedMeta.amount));
        if (r.parceiro !== parceiro) setParceiro(r.parceiro);
      }
    } catch (err) {
      setFeedResult({
        ok: false,
        error: getErrorMessage(err),
        triedIds: [],
        parceiro,
      });
    } finally {
      setLoading(false);
    }
  };

  const initialStatusForStart = (startMs?: number | null): TipStatus =>
    startMs && startMs <= Date.now() && Date.now() - startMs < 3 * 60 * 60 * 1000 ? "ao_vivo" : "aguardando";

  const submit = () => {
    if (mode === "auto") {
      if (feedResult && !feedResult.ok && feedResult.sharedMeta) {
        if (!event.trim() || !palpite.trim() || !odd) return;
        onCreate({
          id: String(feedResult.sharedMeta.betId || crypto.randomUUID()).slice(-8).toUpperCase(),
          status: "aguardando",
          type: "Simples",
          league: league || event,
          event,
          palpite,
          odd: Number(odd) || feedResult.sharedMeta.odd || 1,
          banca: Number(banca) || 10,
          esporte,
          date: new Date().toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          }),
          entradas: 1,
          parceiro: feedResult.parceiro,
          url: url || undefined,
          createdAtMs: Date.now(),
          startMs: null,
        });
        return;
      }
      if (!feedResult || !feedResult.ok || !selected) {
        void buscarNoFeed();
        return;
      }
      onCreate({
        id: String(selected.betId).slice(-8).toUpperCase(),
        status: initialStatusForStart(selected.startMs),
        type: selected.event.toLowerCase().startsWith("múltipla") ? "Múltipla" : "Simples",
        league: selected.competition,
        event: selected.event,
        palpite: palpite.trim() || "Palpite do parceiro",
        odd: Number(odd) || 1.5,
        banca: Number(banca) || 10,
        esporte: selected.sport,
        date: selected.startMs
          ? new Date(selected.startMs).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })
          : new Date().toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            }),
        entradas: selected.event.toLowerCase().startsWith("múltipla")
          ? splitPalpites(palpite.trim() || "Palpite do parceiro").length
          : 1,
        parceiro: feedResult.parceiro,
        url: url || undefined,
        createdAtMs: Date.now(),
        startMs: selected.startMs ?? null,
      });
    } else {
      if (!event.trim() || !palpite.trim() || !odd) return;
      onCreate({
        id: crypto.randomUUID().slice(0, 8).toUpperCase(),
          status: "aguardando",
        type: "Simples",
        league: league || event,
        event,
        palpite,
        odd: Number(odd) || 1,
        banca: Number(banca) || 10,
        esporte,
        date: new Date().toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
        entradas: 1,
        parceiro,
        url: url || undefined,
        createdAtMs: Date.now(),
        startMs: null,
      });
    }
  };

  return (
    <div className={overlay} onClick={onClose}>
      <div className={box} onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="p-5 flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
              <Plus className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Novo Ticket de Tip</h3>
              <p className={`text-xs ${muted}`}>
                Crie automaticamente a partir de um parceiro ou preencha manualmente.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={
              "h-8 w-8 rounded-md inline-flex items-center justify-center " +
              (isDark ? "hover:bg-neutral-800" : "hover:bg-neutral-100")
            }
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-5">
          <div
            className={
              "grid grid-cols-2 rounded-lg border p-1 " +
              (isDark ? "border-neutral-800 bg-neutral-950" : "border-neutral-200 bg-neutral-100")
            }
          >
            {(["auto", "manual"] as const).map((m) => {
              const active = mode === m;
              return (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={
                    "h-9 rounded-md text-sm font-medium inline-flex items-center justify-center gap-2 transition " +
                    (active
                      ? isDark
                        ? "bg-neutral-800 text-white"
                        : "bg-white text-neutral-900 shadow-sm"
                      : muted)
                  }
                >
                  {m === "auto" ? <Wand2 className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                  {m === "auto" ? "Automático" : "Manual"}
                </button>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {mode === "auto" && (
            <div
              className={
                "rounded-lg border p-3 flex items-start gap-2 text-xs " +
                "border-emerald-600/40 bg-emerald-500/5 text-emerald-500"
              }
            >
              <Sparkles className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                Cole a URL de compartilhamento da aposta no parceiro. Nós buscamos os detalhes,
                montamos o palpite e anexamos o link de afiliado automaticamente.
              </span>
            </div>
          )}

          {/* Parceiro dropdown */}
          <div>
            <label className={`text-xs ${muted}`}>Parceiro</label>
            <div className="relative mt-1">
              <button
                onClick={() => setDropOpen((v) => !v)}
                className={
                  field +
                  " flex items-center justify-between text-left"
                }
              >
                <span className="inline-flex items-center gap-2">
                  <ParceiroBadge parceiro={parceiro} />
                  {parceiroLabel}
                </span>
                <span className={muted}>▾</span>
              </button>
              {dropOpen && (
                <div
                  className={
                    "absolute z-10 mt-1 w-full rounded-md border shadow-lg overflow-hidden " +
                    (isDark
                      ? "bg-neutral-950 border-neutral-800"
                      : "bg-white border-neutral-200")
                  }
                >
                  {PARCEIROS.map((p) => (
                    <button
                      key={p.value}
                      onClick={() => {
                        setParceiro(p.value);
                        setDropOpen(false);
                      }}
                      className={
                        "w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm text-left " +
                        (isDark ? "hover:bg-neutral-800" : "hover:bg-neutral-50")
                      }
                    >
                      <span className="inline-flex items-center gap-2">
                        <ParceiroBadge parceiro={p.value} />
                        {p.label}
                        {p.hint && <span className={"text-xs " + muted}>{p.hint}</span>}
                      </span>
                      {parceiro === p.value && <Check className="h-4 w-4 text-emerald-500" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className={`text-[11px] ${muted} mt-1.5`}>
              Exemplo:{" "}
              <code
                className={
                  "px-1.5 py-0.5 rounded " +
                  (isDark ? "bg-neutral-800 text-neutral-300" : "bg-neutral-100 text-neutral-700")
                }
              >
                https://www.seu.bet.br/pre-jogo?bet_id=6249772946
              </code>
            </p>
          </div>

          {/* URL */}
          <div>
            <div className="flex items-center justify-between">
              <label className={`text-xs ${muted}`}>URL da aposta</label>
              {urlParceiro && (
                <span
                  className={
                    "text-[10px] font-semibold uppercase tracking-wider " +
                    (urlMismatch ? "text-red-500" : "text-emerald-500")
                  }
                >
                  {urlMismatch
                    ? `URL é de ${urlParceiro === "seubet" ? "SeuBet" : "H2Bet"}`
                    : `URL do ${urlParceiro === "seubet" ? "SeuBet" : "H2Bet"} ✓`}
                </span>
              )}
            </div>
            <div className="flex gap-2 mt-1">
              <input
                value={url}
                onChange={(e) => {
                  const nextUrl = e.target.value;
                  setUrl(nextUrl);
                  const detected = detectParceiro(nextUrl);
                  if (detected) setParceiro(detected);
                  setFeedResult(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void buscarNoFeed();
                  }
                }}
                placeholder="https://..."
                className={
                  field +
                  (urlMismatch ? " !border-red-500 focus:!border-red-500" : "")
                }
              />
              {mode === "auto" && (
                <button
                  onClick={buscarNoFeed}
                  disabled={loading || !url.trim()}
                  className={
                    "h-10 px-3 rounded-md text-sm font-medium inline-flex items-center gap-2 shrink-0 " +
                    (isDark
                      ? "bg-neutral-800 hover:bg-neutral-700 text-neutral-100"
                      : "bg-neutral-100 hover:bg-neutral-200 text-neutral-800") +
                    (loading || !url.trim()
                      ? " opacity-50 cursor-not-allowed"
                      : "")
                  }
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  Buscar
                </button>
              )}
            </div>
            {urlMismatch && (
              <p className="text-[11px] text-red-500 mt-1.5">
                Essa URL é do {urlParceiro === "seubet" ? "SeuBet" : "H2Bet"}. Troca o parceiro acima
                ou cola uma URL do {parceiro === "seubet" ? "SeuBet" : "H2Bet"}.
              </p>
            )}
          </div>

          {mode === "auto" && feedResult && (
            <div
              className={
                "rounded-lg border p-3 text-xs " +
                (feedResult.ok
                  ? "border-emerald-600/40 bg-emerald-500/5"
                  : "border-red-600/40 bg-red-500/5")
              }
            >
              {feedResult.ok && selected ? (
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-1.5 text-emerald-500 font-semibold">
                    <Check className="h-3.5 w-3.5" />
                    Aposta encontrada
                    <span className={"font-normal " + muted}>
                      (match por {feedResult.matchedBy === "id" ? "ID" : "game_number"}:{" "}
                      {feedResult.matchedValue})
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                    <Info label="Evento" value={selected.event} muted={muted} />
                    <Info label="Esporte" value={selected.sport} muted={muted} />
                    <Info label="Competição" value={selected.competition} muted={muted} />
                    <Info label="Região" value={selected.region} muted={muted} />
                    <Info label="Time 1" value={selected.team1} muted={muted} />
                    <Info label="Time 2" value={selected.team2} muted={muted} />
                    <Info label="Bet ID" value={String(selected.betId)} muted={muted} />
                    {selected.gameNumber != null && (
                      <Info
                        label="Game #"
                        value={String(selected.gameNumber)}
                        muted={muted}
                      />
                    )}
                    {selected.startMs && (
                      <div className="col-span-2">
                        <div className={"text-[10px] uppercase tracking-wider " + muted}>
                          Início
                        </div>
                        <div className="text-xs font-medium">
                          {new Date(selected.startMs).toLocaleString("pt-BR")}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                    <label className="block">
                      <span className={"text-[10px] uppercase tracking-wider " + muted}>
                        Odd
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        value={odd}
                        onChange={(e) => setOdd(e.target.value)}
                        placeholder="1.85"
                        className={field + " mt-0.5"}
                      />
                    </label>
                    <label className="block">
                      <span className={"text-[10px] uppercase tracking-wider " + muted}>
                        Banca %
                      </span>
                      <input
                        type="number"
                        value={banca}
                        onChange={(e) => setBanca(e.target.value)}
                        className={field + " mt-0.5"}
                      />
                    </label>
                    <label className="block">
                      <span className={"text-[10px] uppercase tracking-wider " + muted}>
                        Palpite
                      </span>
                      <input
                        value={palpite}
                        onChange={(e) => setPalpite(e.target.value)}
                        placeholder="Ex: Mais de 2.5 gols"
                        className={field + " mt-0.5"}
                      />
                    </label>
                  </div>
                  <p className={"text-[11px] " + muted}>
                    Odds e palpite vêm do WebSocket do parceiro quando o bet_id ainda está ativo.
                  </p>
                </div>
              ) : !feedResult.ok ? (
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-1.5 text-red-500">
                    <AlertCircle className="h-3.5 w-3.5" /> {getErrorMessage(feedResult.error)}
                  </div>
                  {feedResult.sharedMeta && (
                    <>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-md border border-amber-500/25 bg-amber-500/5 p-2">
                        <Info label="Tipo" value={feedResult.sharedMeta.fixedType || "Simples"} muted={muted} />
                        <Info label="Bet ID" value={feedResult.sharedMeta.betId} muted={muted} />
                        <Info
                          label="Odd"
                          value={feedResult.sharedMeta.odd != null ? String(feedResult.sharedMeta.odd) : "—"}
                          muted={muted}
                        />
                        <Info
                          label="Possível retorno"
                          value={
                            feedResult.sharedMeta.possibleWin != null
                              ? feedResult.sharedMeta.possibleWin.toLocaleString("pt-BR", {
                                  style: "currency",
                                  currency: "BRL",
                                })
                              : "—"
                          }
                          muted={muted}
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                        <label className="block">
                          <span className={"text-[10px] uppercase tracking-wider " + muted}>
                            Evento
                          </span>
                          <input
                            value={event}
                            onChange={(e) => setEvent(e.target.value)}
                            placeholder="Ex: Brasil x Argentina"
                            className={field + " mt-0.5"}
                          />
                        </label>
                        <label className="block">
                          <span className={"text-[10px] uppercase tracking-wider " + muted}>
                            Palpite
                          </span>
                          <input
                            value={palpite}
                            onChange={(e) => setPalpite(e.target.value)}
                            placeholder="Ex: Mais de 1.5 gols"
                            className={field + " mt-0.5"}
                          />
                        </label>
                        <label className="block">
                          <span className={"text-[10px] uppercase tracking-wider " + muted}>
                            Odd
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            value={odd}
                            onChange={(e) => setOdd(e.target.value)}
                            placeholder="1.35"
                            className={field + " mt-0.5"}
                          />
                        </label>
                      </div>
                    </>
                  )}
                  {Array.isArray(feedResult.triedIds) && feedResult.triedIds.length > 0 && (
                    <div className={"text-[11px] " + muted}>
                      IDs testados: {feedResult.triedIds.slice(0, 6).join(", ")}
                      {feedResult.triedIds.length > 6 ? "…" : ""}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}


          {mode === "manual" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className={`text-xs ${muted}`}>Evento / Partida</label>
                <input
                  value={event}
                  onChange={(e) => setEvent(e.target.value)}
                  placeholder="Ex: Brasil x Argentina"
                  className={field + " mt-1"}
                />
              </div>
              <div>
                <label className={`text-xs ${muted}`}>Campeonato</label>
                <input
                  value={league}
                  onChange={(e) => setLeague(e.target.value)}
                  placeholder="Ex: Brasileirão Série A"
                  className={field + " mt-1"}
                />
              </div>
              <div className="md:col-span-2">
                <label className={`text-xs ${muted}`}>Palpite</label>
                <input
                  value={palpite}
                  onChange={(e) => setPalpite(e.target.value)}
                  placeholder="Ex: Mais de 2.5 gols"
                  className={field + " mt-1"}
                />
              </div>
              <div>
                <label className={`text-xs ${muted}`}>Odd</label>
                <input
                  type="number"
                  step="0.01"
                  value={odd}
                  onChange={(e) => setOdd(e.target.value)}
                  placeholder="1.85"
                  className={field + " mt-1"}
                />
              </div>
              <div>
                <label className={`text-xs ${muted}`}>Banca (%)</label>
                <input
                  type="number"
                  value={banca}
                  onChange={(e) => setBanca(e.target.value)}
                  className={field + " mt-1"}
                />
              </div>
              <div className="md:col-span-2">
                <label className={`text-xs ${muted}`}>Esporte</label>
                <select
                  value={esporte}
                  onChange={(e) => setEsporte(e.target.value)}
                  className={field + " mt-1"}
                >
                  <option>Futebol</option>
                  <option>Basquete</option>
                  <option>Tênis</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className={
            "p-4 flex items-center justify-end gap-2 border-t " +
            (isDark ? "border-neutral-800" : "border-neutral-200")
          }
        >
          <button
            onClick={onClose}
            className={
              "h-10 px-4 rounded-md text-sm font-medium " +
              (isDark
                ? "bg-neutral-800 hover:bg-neutral-700 text-neutral-100"
                : "bg-neutral-100 hover:bg-neutral-200 text-neutral-800")
            }
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            style={{
              backgroundImage:
                "linear-gradient(90deg, #0f5f2a 0%, #1f8a3a 55%, #54ee2b 100%)",
            }}
            className="h-10 px-5 rounded-md text-white text-sm font-semibold inline-flex items-center gap-2 hover:brightness-110 active:brightness-95 shadow-sm"
          >
            {mode === "auto" ? (
              selected || canCreateRecoveredShared ? (
                <>
                  <Plus className="h-4 w-4" /> Criar ticket
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" /> Buscar aposta
                </>
              )
            ) : (
              <>
                <Plus className="h-4 w-4" /> Criar ticket
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function ParceiroBadge({ parceiro }: { parceiro: Parceiro }) {
  if (parceiro === "seubet") {
    return (
      <span className="h-6 w-6 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center text-[10px] font-bold">
        SB
      </span>
    );
  }
  return (
    <span className="h-6 w-6 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center text-[10px] font-bold">
      H2
    </span>
  );
}

function Info({ label, value, muted }: { label: string; value: string; muted: string }) {
  return (
    <div>
      <div className={"text-[10px] uppercase tracking-wider " + muted}>{label}</div>
      <div className="text-xs font-medium truncate">{value || "—"}</div>
    </div>
  );
}

function DetailsModal({
  isDark,
  ticket,
  onClose,
  onStatus,
  onDelete,
}: {
  isDark: boolean;
  ticket: Ticket;
  onClose: () => void;
  onStatus: (s: TipStatus) => void;
  onDelete: () => void;
}) {
  const overlay =
    "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm";
  const box =
    "w-full max-w-xl rounded-2xl border shadow-2xl " +
    (isDark
      ? "bg-neutral-900 border-neutral-800 text-neutral-100"
      : "bg-white border-neutral-200 text-neutral-900");
  const muted = isDark ? "text-neutral-400" : "text-neutral-500";
  const inner = isDark ? "bg-neutral-950/50 border-neutral-800" : "bg-neutral-50 border-neutral-200";

  const fmt = (ms?: number | null) =>
    ms
      ? new Date(ms).toLocaleString("pt-BR", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—";

  const parceiroLabel =
    ticket.parceiro === "seubet" ? "SeuBet" : ticket.parceiro === "h2bet" ? "H2Bet" : "—";

  return (
    <div className={overlay} onClick={onClose}>
      <div className={box} onClick={(e) => e.stopPropagation()}>
        <div className="p-5 flex items-start justify-between border-b border-inherit">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
              <Eye className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-lg leading-tight">{ticket.event}</h3>
              <p className={`text-xs ${muted}`}>
                {ticket.league} · <span className="font-mono">{ticket.id}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={
              "h-8 w-8 rounded-md inline-flex items-center justify-center " +
              (isDark ? "hover:bg-neutral-800" : "hover:bg-neutral-100")
            }
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="flex items-center gap-2 flex-wrap">
            <StatusPill status={ticket.status} />
            <span
              className={
                "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium border " +
                (isDark
                  ? "border-neutral-700 text-neutral-300 bg-neutral-800/50"
                  : "border-neutral-200 text-neutral-600 bg-neutral-100")
              }
            >
              {ticket.type}
            </span>
            <span className={`text-xs ${muted}`}>{ticket.esporte}</span>
          </div>

          {/* Rich data ao vivo do Statpal (só futebol) */}
          {(ticket.esporte || "").toLowerCase().includes("fute") && (
            <RichMatchPanel ticket={ticket} isDark={isDark} muted={muted} inner={inner} />
          )}

          <div className={`rounded-lg border ${inner} px-3 py-2.5`}>
            <div className={`text-[10px] uppercase tracking-wider ${muted}`}>Palpite</div>
            <div className="text-sm font-medium mt-0.5">{ticket.palpite}</div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className={`rounded-lg border ${inner} px-3 py-2.5`}>
              <div className={`text-[10px] uppercase tracking-wider ${muted}`}>Odd</div>
              <div className="text-sm font-semibold mt-0.5">{ticket.odd.toFixed(2)}</div>
            </div>
            <div className={`rounded-lg border ${inner} px-3 py-2.5`}>
              <div className={`text-[10px] uppercase tracking-wider ${muted}`}>Banca</div>
              <div className="text-sm font-semibold mt-0.5">{ticket.banca.toFixed(1)}%</div>
            </div>
            <div className={`rounded-lg border ${inner} px-3 py-2.5`}>
              <div className={`text-[10px] uppercase tracking-wider ${muted}`}>Parceiro</div>
              <div className="text-sm font-semibold mt-0.5">{parceiroLabel}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className={`rounded-lg border ${inner} px-3 py-2.5`}>
              <div className={`text-[10px] uppercase tracking-wider ${muted} inline-flex items-center gap-1`}>
                <Calendar className="h-3 w-3" /> Início do jogo
              </div>
              <div className="text-sm font-medium mt-0.5">
                {ticket.startMs ? fmt(ticket.startMs) : "Não informado"}
              </div>
            </div>
            <div className={`rounded-lg border ${inner} px-3 py-2.5`}>
              <div className={`text-[10px] uppercase tracking-wider ${muted} inline-flex items-center gap-1`}>
                <Calendar className="h-3 w-3" /> Ticket criado em
              </div>
              <div className="text-sm font-medium mt-0.5">{fmt(ticket.createdAtMs)}</div>
            </div>
          </div>

          {ticket.url && (
            <div>
              <div className={`text-[10px] uppercase tracking-wider ${muted} mb-1`}>URL da aposta</div>
              <a
                href={ticket.url}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-emerald-500 hover:underline break-all"
              >
                {ticket.url}
              </a>
            </div>
          )}


          <div>
            <div className={`text-[10px] uppercase tracking-wider ${muted} mb-2`}>Marcar resultado</div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => onStatus("ao_vivo")}
                className={
                  "h-9 px-3 rounded-md text-xs font-semibold border inline-flex items-center gap-1.5 " +
                  (ticket.status === "ao_vivo"
                    ? "bg-amber-500/15 border-amber-500/40 text-amber-500"
                    : isDark
                      ? "border-neutral-800 text-neutral-300 hover:bg-neutral-800"
                      : "border-neutral-300 text-neutral-700 hover:bg-neutral-50")
                }
              >
                <Radio className="h-3.5 w-3.5" /> Ao vivo
              </button>
              <button
                onClick={() => onStatus("green")}
                className={
                  "h-9 px-3 rounded-md text-xs font-semibold border inline-flex items-center gap-1.5 " +
                  (ticket.status === "green"
                    ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-500"
                    : isDark
                      ? "border-neutral-800 text-neutral-300 hover:bg-neutral-800"
                      : "border-neutral-300 text-neutral-700 hover:bg-neutral-50")
                }
              >
                <TrendingUp className="h-3.5 w-3.5" /> Green
              </button>
              <button
                onClick={() => onStatus("red")}
                className={
                  "h-9 px-3 rounded-md text-xs font-semibold border inline-flex items-center gap-1.5 " +
                  (ticket.status === "red"
                    ? "bg-red-500/15 border-red-500/40 text-red-500"
                    : isDark
                      ? "border-neutral-800 text-neutral-300 hover:bg-neutral-800"
                      : "border-neutral-300 text-neutral-700 hover:bg-neutral-50")
                }
              >
                <TrendingUp className="h-3.5 w-3.5 rotate-180" /> Red
              </button>
            </div>
          </div>
        </div>

        <div
          className={
            "p-4 flex items-center justify-between gap-2 border-t " +
            (isDark ? "border-neutral-800" : "border-neutral-200")
          }
        >
          <button
            onClick={onDelete}
            className="h-10 px-4 rounded-md text-sm font-medium text-red-500 hover:bg-red-500/10"
          >
            Excluir ticket
          </button>
          <button
            onClick={onClose}
            className={
              "h-10 px-4 rounded-md text-sm font-medium " +
              (isDark
                ? "bg-neutral-800 hover:bg-neutral-700 text-neutral-100"
                : "bg-neutral-100 hover:bg-neutral-200 text-neutral-800")
            }
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Rich Match Panel (ao vivo, futebol) ----------

function eventLabel(type: string): { label: string; icon: string; color: string } {
  const t = type.toLowerCase();
  if (t.includes("goal")) return { label: "Gol", icon: "⚽", color: "text-emerald-500" };
  if (t.includes("yellowred") || (t.includes("red") && !t.includes("card"))) return { label: "2º amarelo → vermelho", icon: "🟨🟥", color: "text-red-500" };
  if (t.includes("redcard") || t === "red") return { label: "Cartão vermelho", icon: "🟥", color: "text-red-500" };
  if (t.includes("yellow")) return { label: "Cartão amarelo", icon: "🟨", color: "text-amber-500" };
  if (t.includes("sub")) return { label: "Substituição", icon: "🔁", color: "text-sky-500" };
  if (t.includes("pen")) return { label: "Pênalti", icon: "🎯", color: "text-emerald-500" };
  if (t.includes("var")) return { label: "VAR", icon: "📺", color: "text-neutral-400" };
  return { label: type || "Evento", icon: "•", color: "text-neutral-400" };
}

function cashOutHint(entryOdd: number, liveOdd: number | null): {
  label: string;
  tone: "green" | "red" | "neutral";
} | null {
  if (!liveOdd || !Number.isFinite(liveOdd)) return null;
  const ratio = liveOdd / entryOdd;
  if (ratio <= 0.5) return { label: "Cash-out AGORA — probabilidade favorável", tone: "green" };
  if (ratio <= 0.75) return { label: "Considerar cash-out parcial", tone: "green" };
  if (ratio >= 1.5) return { label: "Segurar — a aposta se valorizou muito", tone: "red" };
  return { label: "Situação neutra — sem urgência", tone: "neutral" };
}

function RichMatchPanel({
  ticket,
  isDark,
  muted,
  inner,
}: {
  ticket: Ticket;
  isDark: boolean;
  muted: string;
  inner: string;
}) {
  const fetchMatchRichData = useServerFn(getMatchRichData);
  const [state, setState] = useState<{
    loading: boolean;
    data: RichMatchResponse | null;
    cached: boolean;
  }>({ loading: true, data: null, cached: false });

  useEffect(() => {
    let cancelled = false;
    const parts = ticket.event.split(/\s+(?:vs|x|×|-)\s+/i);
    const t1 = (parts[0] ?? "").trim();
    const t2 = (parts[1] ?? "").trim();
    if (!t1 || !t2) {
      setState({ loading: false, data: { ok: false, error: "Não consegui extrair times do evento." }, cached: false });
      return;
    }

    // 1. Cache first — mostra na hora e evita request se ainda válido
    const cached = getCachedRich(t1, t2);
    const cachedFinished = !!(cached?.ok && cached.match?.finished);
    if (cached) {
      setState({ loading: false, data: cached, cached: true });
      // Se jogo já finalizou, cache é a fonte da verdade — não refaz nada.
      if (cachedFinished) return;
    }

    const load = async () => {
      try {
        const res = await fetchMatchRichData({ data: { team1: t1, team2: t2 } });
        if (cancelled) return;
        setCachedRich(t1, t2, res);
        setState({ loading: false, data: res, cached: false });
      } catch (e) {
        if (!cancelled && !cached)
          setState({
            loading: false,
            data: { ok: false, error: e instanceof Error ? e.message : "Erro" },
            cached: false,
          });
      }
    };
    // Se não tinha cache, busca agora. Se tinha (e não terminou), atualiza em 45s.
    if (!cached) load();
    const id = setInterval(load, 45_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [ticket.event]);

  if (state.loading) {
    return (
      <div className={`rounded-lg border ${inner} px-3 py-4 flex items-center gap-2 text-sm ${muted}`}>
        <Loader2 className="h-4 w-4 animate-spin" /> Buscando dados ao vivo…
      </div>
    );
  }
  const res = state.data;
  if (!res || !res.ok || !res.match) {
    return (
      <div className={`rounded-lg border ${inner} px-3 py-3 text-xs ${muted} flex items-start gap-2`}>
        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
        <span>Sem dados ao vivo: {getErrorMessage(res?.error) || "jogo não encontrado"}.</span>
      </div>
    );
  }

  const m = res.match;
  const scoreTxt = `${m.home.goals ?? 0} - ${m.away.goals ?? 0}`;
  const statusBadge = m.finished
    ? { label: `Encerrado (${m.status})`, cls: "bg-neutral-500/15 text-neutral-400 border-neutral-500/30" }
    : { label: `Ao vivo · ${m.status}${m.minute ? ` ${m.minute}'` : ""}`, cls: "bg-red-500/15 text-red-500 border-red-500/30 animate-pulse" };

  const pred = res.prediction;
  const odds = Array.isArray(res.odds) ? res.odds : [];
  const events = Array.isArray(m.events) ? m.events : [];

  // Try to guess relevant live odd for cash-out (1X2 based on palpite)
  const p = ticket.palpite.toLowerCase();
  let relevantOdd: number | null = null;
  if (odds && odds.length) {
    const find = (needles: string[]) =>
      odds.find((o) => needles.some((n) => o.selection.toLowerCase().includes(n)))?.odd ?? null;
    if (/empate|draw/.test(p)) relevantOdd = find(["draw", "empate", "x"]);
    else if (/casa|home|mandante/.test(p)) relevantOdd = find(["home", "1", "casa"]);
    else if (/fora|away|visitante/.test(p)) relevantOdd = find(["away", "2", "fora"]);
  }
  const cash = cashOutHint(ticket.odd, relevantOdd);

  return (
    <div className={`rounded-xl border ${inner} p-4 space-y-4`}>
      {/* Placar + status */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="text-2xl font-bold tabular-nums">{scoreTxt}</div>
          <div className="text-xs">
            <div className="font-medium">{m.home.name} vs {m.away.name}</div>
            {m.league && <div className={muted}>{m.league}</div>}
          </div>
        </div>
        <span className={`text-[11px] font-semibold px-2 py-1 rounded-full border ${statusBadge.cls}`}>
          {statusBadge.label}
        </span>
      </div>

      {/* Predição / probabilidade */}
      {pred && (pred.homeWin != null || pred.draw != null || pred.awayWin != null) && (
        <div>
          <div className={`text-[10px] uppercase tracking-wider ${muted} mb-1.5 inline-flex items-center gap-1`}>
            <PieChart className="h-3 w-3" /> Probabilidade
          </div>
          <div className="flex h-6 rounded-md overflow-hidden text-[10px] font-bold text-white">
            {pred.homeWin != null && (
              <div className="bg-emerald-600 flex items-center justify-center" style={{ width: `${(pred.homeWin * 100).toFixed(0)}%` }}>
                {(pred.homeWin * 100).toFixed(0)}%
              </div>
            )}
            {pred.draw != null && (
              <div className="bg-neutral-500 flex items-center justify-center" style={{ width: `${(pred.draw * 100).toFixed(0)}%` }}>
                {(pred.draw * 100).toFixed(0)}%
              </div>
            )}
            {pred.awayWin != null && (
              <div className="bg-red-600 flex items-center justify-center" style={{ width: `${(pred.awayWin * 100).toFixed(0)}%` }}>
                {(pred.awayWin * 100).toFixed(0)}%
              </div>
            )}
          </div>
          <div className={`flex justify-between text-[10px] mt-1 ${muted}`}>
            <span>Casa</span><span>Empate</span><span>Fora</span>
          </div>
          {pred.advice && <div className="text-xs mt-2 italic">💡 {pred.advice}</div>}
        </div>
      )}

      {/* Cash-out */}
      {cash && (
        <div
          className={
            "rounded-lg border px-3 py-2 text-xs font-medium inline-flex items-center gap-2 " +
            (cash.tone === "green"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
              : cash.tone === "red"
                ? "bg-red-500/10 border-red-500/30 text-red-500"
                : "bg-amber-500/10 border-amber-500/30 text-amber-500")
          }
        >
          <Zap className="h-3.5 w-3.5" /> {cash.label}
          {relevantOdd && (
            <span className={muted}>
              (odd entrada {ticket.odd.toFixed(2)} → ao vivo {relevantOdd.toFixed(2)})
            </span>
          )}
        </div>
      )}

      {/* Eventos */}
      {events.length > 0 && (
        <div>
          <div className={`text-[10px] uppercase tracking-wider ${muted} mb-1.5 inline-flex items-center gap-1`}>
            <Activity className="h-3 w-3" /> Eventos ({events.length})
          </div>
          <ul className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
            {events.map((ev) => {
              const meta = eventLabel(ev.type);
              const teamName = ev.team === "home" ? m.home.name : ev.team === "away" ? m.away.name : ev.team;
              return (
                <li key={ev.id} className="flex items-start gap-2 text-xs">
                  <span className="tabular-nums font-mono text-[10px] w-8 shrink-0 pt-0.5">
                    {ev.minute}{ev.extraMin ? `+${ev.extraMin}` : ""}'
                  </span>
                  <span className="shrink-0">{meta.icon}</span>
                  <span className="flex-1 min-w-0">
                    <span className={`font-semibold ${meta.color}`}>{meta.label}</span>{" "}
                    — <span className="font-medium">{ev.player || "?"}</span>
                    <span className={muted}> · {teamName}</span>
                    {ev.result && <span className={muted}> {ev.result}</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Odds ao vivo (top 6) */}
      {odds && odds.length > 0 && (
        <div>
          <div className={`text-[10px] uppercase tracking-wider ${muted} mb-1.5 inline-flex items-center gap-1`}>
            <ShieldAlert className="h-3 w-3" /> Odds ao vivo
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {odds.slice(0, 9).map((o, i) => (
              <div key={i} className={`rounded-md border ${isDark ? "border-neutral-800" : "border-neutral-200"} px-2 py-1.5`}>
                <div className={`text-[9px] uppercase ${muted} truncate`}>{o.market}</div>
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs truncate">{o.selection}</span>
                  <span className="text-xs font-bold text-emerald-500 tabular-nums">{o.odd.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
