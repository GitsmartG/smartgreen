import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { loadTickets, saveTickets, type Ticket, type TipStatus, type Parceiro as ParceiroT } from "@/lib/tickets-store";
import { importBetTip, type BetTipsResult } from "@/lib/bet-tips";
import { getSoccerLivescores } from "@/lib/livescores.functions";
import { findMatchForTicket, gradePalpite, gradeSinglePalpite } from "@/lib/auto-settle";
import { getMatchRichData, type RichMatchResponse } from "@/lib/soccer-details.functions";
import { getCachedRich, setCachedRich } from "@/lib/rich-cache";
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

  const [tickets, setTickets] = useState<Ticket[]>(() => loadTickets());
  useEffect(() => {
    saveTickets(tickets);
  }, [tickets]);

  const [liveMap, setLiveMap] = useState<Record<string, LiveState>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [lastCheckMs, setLastCheckMs] = useState<number | null>(null);

  const runCheck = async () => {
    const relevant = tickets.filter((t) => (t.esporte || "").toLowerCase().includes("fute"));
    if (!relevant.length) return;
    setRefreshing(true);
    try {
      const res = await getSoccerLivescores();
      if (!res.ok) return;
      const matches = Array.isArray(res.matches) ? res.matches : [];

      const nextLive: Record<string, LiveState> = {};
      for (const t of tickets) {
        const m = findMatchForTicket(t, matches);
        if (!m) continue;
        const swapped = isSwappedMatch(t, m.team1, m.team2);
        nextLive[t.id] = {
          status: m.status,
          live: m.live,
          finished: m.finished,
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
      setLiveMap(nextLive);

      setTickets((prev) => {
        let changed = false;
        const next = prev.map((t) => {
          if (!(t.esporte || "").toLowerCase().includes("fute")) return t;
          const m = findMatchForTicket(t, matches);
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

            // status por perna (só faz sentido se tiver placar)
            const legs = splitPalpites(t.palpite);
            if (legs.length > 0 && (score1 != null || score2 != null)) {
              const statuses: TipStatus[] = legs.map((leg) => {
                const g = gradeSinglePalpite(leg, m, t);
                if (g) return g;
                return m.live ? "ao_vivo" : "aguardando";
              });
              const prev = t.legStatuses ?? [];
              const same =
                prev.length === statuses.length && prev.every((s, i) => s === statuses[i]);
              if (!same) patch.legStatuses = statuses;
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
            if (m.live && t.status !== "ao_vivo") {
              changed = true;
              return { ...t, ...patch, status: "ao_vivo" as TipStatus };
            }
            if (m.finished && t.status === "ao_vivo") {
              changed = true;
              return { ...t, ...patch, status: "aguardando" as TipStatus };
            }
            if (!m.live && !m.finished && t.status !== "aguardando") {
              changed = true;
              return { ...t, ...patch, status: "aguardando" as TipStatus };
            }
            if (Object.keys(patch).length > 1) changed = true;
            return Object.keys(patch).length > 1 ? { ...t, ...patch } : t;
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
  }, [tickets.length]);


  const [tab, setTab] = useState<Tab>("todos");
  const [query, setQuery] = useState("");
  const [esporte, setEsporte] = useState("todos");
  const [tipo, setTipo] = useState("todos");
  const [modalOpen, setModalOpen] = useState(false);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const detailsTicket = detailsId ? tickets.find((t) => t.id === detailsId) ?? null : null;

  const updateStatus = (id: string, status: TipStatus) =>
    setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
  const removeTicket = (id: string) => {
    setTickets((prev) => prev.filter((t) => t.id !== id));
    setDetailsId(null);
  };

  const counts = useMemo(() => {
    return {
      aguardando: tickets.filter((t) => t.status === "aguardando").length,
      ao_vivo: tickets.filter((t) => t.status === "ao_vivo").length,
      green: tickets.filter((t) => t.status === "green").length,
      red: tickets.filter((t) => t.status === "red").length,
    };
  }, [tickets]);


  const filtered = useMemo(() => {
    return tickets.filter((t) => {
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
  }, [tickets, tab, tipo, esporte, query]);

  const addTicket = (t: Ticket) => setTickets((prev) => [t, ...prev]);

  return (
    <div className="space-y-4">
      {/* Topo */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Tickets de Tips</h2>
          <p className={`text-xs ${muted} mt-0.5 flex items-center gap-2 flex-wrap`}>
            <span>{tickets.length} tickets no total</span>
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
  const isMultipla = ticket.type === "Múltipla";
  const parts = ticket.event.split(/\s+(?:vs|x|×|-)\s+/i);
  const team1 = (parts[0] ?? ticket.event).trim();
  const team2 = (parts[1] ?? "").trim();
  const isLive = live?.live && !live.finished;
  const score1 = live?.score1 ?? ticket.score1;
  const score2 = live?.score2 ?? ticket.score2;
  const team1Logo =
    (live?.team1Logo ?? ticket.team1Logo) ||
    (live?.team1Id ? `/api/public/team-image/${live.team1Id}?type=team` : undefined);
  const team2Logo =
    (live?.team2Logo ?? ticket.team2Logo) ||
    (live?.team2Id ? `/api/public/team-image/${live.team2Id}?type=team` : undefined);
  const showScore = score1 != null || score2 != null;

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
            {ticket.type}
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

      {/* Palpites (lista) com status por perna */}
      <div className={`rounded-xl border ${inner} p-3`}>
        <div className={`text-[10px] uppercase tracking-wider ${subtle} mb-2`}>
          {palpites.length > 1 ? `Palpites (${palpites.length})` : "Palpite"}
        </div>
        <ul className="flex flex-col gap-1.5">
          {palpites.map((p, i) => {
            const legStatus = ticket.legStatuses?.[i];
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

function splitPalpites(raw: string): string[] {
  if (!raw) return ["—"];
  const parts = raw
    .split(/\r?\n|;| \+ | \/ | \| /g)
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length ? parts : [raw.trim()];
}

function normalizedText(s: string): string {
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
    .replace(/\bitalia\b/g, "italy")
    .replace(/\bholanda\b|\bpaises baixos\b/g, "netherlands");
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
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "?";
  const fallback = isDark
    ? "bg-neutral-800 text-neutral-300 border-neutral-700"
    : "bg-neutral-100 text-neutral-600 border-neutral-200";
  return (
    <div
      className={`flex-1 min-w-0 flex items-center gap-2 ${align === "right" ? "flex-row-reverse text-right" : ""}`}
    >
      {logo ? (
        <img
          src={logo}
          alt={name}
          className="h-10 w-10 object-contain shrink-0"
          loading="lazy"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
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
        const res = await getMatchRichData({ data: { team1: t1, team2: t2 } });
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
        <span>Sem dados ao vivo: {res?.error ?? "jogo não encontrado"}.</span>
      </div>
    );
  }

  const m = res.match;
  const scoreTxt = `${m.home.goals ?? 0} - ${m.away.goals ?? 0}`;
  const statusBadge = m.finished
    ? { label: `Encerrado (${m.status})`, cls: "bg-neutral-500/15 text-neutral-400 border-neutral-500/30" }
    : { label: `Ao vivo · ${m.status}${m.minute ? ` ${m.minute}'` : ""}`, cls: "bg-red-500/15 text-red-500 border-red-500/30 animate-pulse" };

  const pred = res.prediction;
  const odds = res.odds;

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
      {m.events.length > 0 && (
        <div>
          <div className={`text-[10px] uppercase tracking-wider ${muted} mb-1.5 inline-flex items-center gap-1`}>
            <Activity className="h-3 w-3" /> Eventos ({m.events.length})
          </div>
          <ul className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
            {m.events.map((ev) => {
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
