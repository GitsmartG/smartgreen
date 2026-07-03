import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { lookupBetInFeed, type FeedLookupResult } from "@/lib/feed-odds.functions";
import { Loader2, AlertCircle } from "lucide-react";
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

type Parceiro = "seubet" | "h2bet";
const PARCEIROS: { value: Parceiro; label: string; hint?: string }[] = [
  { value: "seubet", label: "SeuBet" },
  { value: "h2bet", label: "H2Bet", hint: "(manual)" },
];

type TipStatus = "ao_vivo" | "green" | "red";

type Ticket = {
  id: string;
  status: TipStatus;
  type: "Simples" | "Múltipla";
  league: string;
  event: string;
  palpite: string;
  odd: number;
  banca: number;
  esporte: string;
  date: string;
  entradas: number;
  parceiro?: Parceiro;
  url?: string;
};

const INITIAL_TICKETS: Ticket[] = [
  {
    id: "E461FBEF",
    status: "ao_vivo",
    type: "Simples",
    league: "Mundial de Seleções",
    event: "Mundial de Seleções",
    palpite: "Mais de 1.5 gols/ +6.5 escanteios",
    odd: 1.49,
    banca: 10,
    esporte: "Futebol",
    date: "03 de jul. de 2026",
    entradas: 1,
  },
  {
    id: "AD49FA13",
    status: "green",
    type: "Simples",
    league: "Mundial de Seleções",
    event: "Mundial de Seleções",
    palpite: "Mais de 1.5 Gols no jogo",
    odd: 1.4,
    banca: 10,
    esporte: "Futebol",
    date: "03 de jul. de 2026",
    entradas: 1,
  },
  {
    id: "370023B1",
    status: "ao_vivo",
    type: "Simples",
    league: "TopLyga",
    event: "TopLyga",
    palpite: "Mais de 0.5 Gols no jogo",
    odd: 1.36,
    banca: 10,
    esporte: "Futebol",
    date: "03 de jul. de 2026",
    entradas: 1,
  },
  {
    id: "CFE5A811",
    status: "red",
    type: "Simples",
    league: "Segunda Divisão - Over Gols",
    event: "Cazaquistão",
    palpite: "Mais de 4.5 gols",
    odd: 1.35,
    banca: 10,
    esporte: "Futebol",
    date: "03 de jul. de 2026",
    entradas: 1,
  },
];

export const Route = createFileRoute("/dashboard/dicas")({
  component: DicasPage,
});

type Tab = "todos" | "ao_vivo" | "green" | "red";

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

  const [tickets, setTickets] = useState<Ticket[]>(INITIAL_TICKETS);
  const [tab, setTab] = useState<Tab>("todos");
  const [query, setQuery] = useState("");
  const [esporte, setEsporte] = useState("todos");
  const [tipo, setTipo] = useState("todos");
  const [modalOpen, setModalOpen] = useState(false);

  const counts = useMemo(() => {
    return {
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
          <p className={`text-xs ${muted} mt-0.5 flex items-center gap-2`}>
            <span>{tickets.length} tickets no total</span>
            <span>·</span>
            <span className="inline-flex items-center gap-1 text-emerald-500">
              <Radio className="h-3 w-3" /> Tempo real ativo
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className={
              "h-10 px-4 rounded-md border text-sm font-medium inline-flex items-center gap-2 transition-colors " +
              (isDark
                ? "border-neutral-800 bg-neutral-900 text-neutral-200 hover:bg-neutral-800"
                : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50")
            }
          >
            <RefreshCw className="h-4 w-4" /> Atualizar
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((t) => (
            <TicketCard key={t.id} ticket={t} isDark={isDark} subtle={subtle} muted={muted} />
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
  color: "amber" | "emerald" | "red";
  isDark: boolean;
  children: React.ReactNode;
}) {
  const palette = {
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
  }[color];

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
  isDark,
  subtle,
  muted,
}: {
  ticket: Ticket;
  isDark: boolean;
  subtle: string;
  muted: string;
}) {
  const card = isDark
    ? "bg-neutral-900 border-neutral-800"
    : "bg-white border-neutral-200";
  const inner = isDark ? "bg-neutral-950/50" : "bg-neutral-50";

  return (
    <div className={`rounded-xl border ${card} p-4 flex flex-col gap-3`}>
      <div className="flex items-start justify-between">
        <div className={`text-[11px] font-mono tracking-wider ${subtle}`}>
          {ticket.id}
        </div>
        <button
          className={
            "h-7 w-7 rounded-md inline-flex items-center justify-center " +
            (isDark
              ? "hover:bg-neutral-800 text-neutral-400"
              : "hover:bg-neutral-100 text-neutral-500")
          }
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>

      <div className="flex items-center gap-2 -mt-1">
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
      </div>

      <div>
        <div className="font-semibold leading-tight">{ticket.league}</div>
        <div className={`text-xs ${muted}`}>{ticket.event}</div>
      </div>

      <div className={`rounded-lg ${inner} px-3 py-2.5`}>
        <div className={`text-[10px] uppercase tracking-wider ${subtle}`}>
          Palpite
        </div>
        <div className="text-sm font-medium mt-0.5">{ticket.palpite}</div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-sm">
        <Stat label="ODD" value={ticket.odd.toFixed(2)} muted={subtle} />
        <Stat label="BANCA" value={`${ticket.banca.toFixed(1)}%`} muted={subtle} />
        <div>
          <div className={`text-[10px] uppercase tracking-wider ${subtle}`}>
            Esporte
          </div>
          <div className="text-sm font-semibold mt-0.5">{ticket.esporte}</div>
        </div>
      </div>

      <div
        className={
          "flex items-center justify-between text-xs pt-2 border-t " +
          (isDark ? "border-neutral-800" : "border-neutral-200")
        }
      >
        <span className={`inline-flex items-center gap-1.5 ${muted}`}>
          <Calendar className="h-3.5 w-3.5" /> {ticket.date}
        </span>
        <span className={muted}>
          {ticket.entradas} entrada{ticket.entradas !== 1 && "s"}
        </span>
      </div>

      <button
        className={
          "h-9 rounded-md text-sm font-medium inline-flex items-center justify-center gap-2 transition-colors " +
          (isDark
            ? "bg-neutral-800 hover:bg-neutral-700 text-neutral-100"
            : "bg-neutral-100 hover:bg-neutral-200 text-neutral-800")
        }
      >
        <Eye className="h-4 w-4" /> Ver Detalhes
      </button>
    </div>
  );
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
  const [feedResult, setFeedResult] = useState<FeedLookupResult | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [query, setQuery] = useState("");
  const lookup = useServerFn(lookupBetInFeed);
  const selected =
    feedResult && feedResult.ok ? feedResult.matches[selectedIdx] : null;

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

  const buscarNoFeed = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setFeedResult(null);
    try {
      const r = await lookup({ data: { url, parceiro } });
      setFeedResult(r);
    } catch (err) {
      setFeedResult({
        ok: false,
        error: err instanceof Error ? err.message : "Erro ao buscar no feed.",
        betId: null,
      });
    } finally {
      setLoading(false);
    }
  };

  const submit = () => {
    if (mode === "auto") {
      if (!url.trim()) return;
      if (!feedResult) {
        void buscarNoFeed();
        return;
      }
      if (!feedResult.ok) return;
      onCreate({
        id: String(feedResult.betId).slice(-8).toUpperCase(),
        status: "ao_vivo",
        type: "Simples",
        league: feedResult.competition,
        event: feedResult.event,
        palpite: "Palpite importado do parceiro",
        odd: Number(odd) || 1.5,
        banca: Number(banca) || 10,
        esporte: feedResult.sport,
        date: feedResult.startTs
          ? new Date(feedResult.startTs * 1000).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })
          : new Date().toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            }),
        entradas: 1,
        parceiro,
        url,
      });
    } else {
      if (!event.trim() || !palpite.trim() || !odd) return;
      onCreate({
        id: crypto.randomUUID().slice(0, 8).toUpperCase(),
        status: "ao_vivo",
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
            <label className={`text-xs ${muted}`}>URL da aposta</label>
            <div className="flex gap-2 mt-1">
              <input
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setFeedResult(null);
                }}
                placeholder="https://..."
                className={field}
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
                    (loading || !url.trim() ? " opacity-50 cursor-not-allowed" : "")
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
              {feedResult.ok ? (
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 text-emerald-500 font-semibold">
                    <Check className="h-3.5 w-3.5" /> Aposta encontrada no feed
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 mt-2">
                    <Info label="Evento" value={feedResult.event} muted={muted} />
                    <Info label="Esporte" value={feedResult.sport} muted={muted} />
                    <Info label="Competição" value={feedResult.competition} muted={muted} />
                    <Info label="Região" value={feedResult.region} muted={muted} />
                    <Info label="Bet ID" value={String(feedResult.betId)} muted={muted} />
                    {feedResult.startTs && (
                      <Info
                        label="Início"
                        value={new Date(feedResult.startTs * 1000).toLocaleString("pt-BR")}
                        muted={muted}
                      />
                    )}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className={"text-[10px] uppercase tracking-wider " + muted}>Odd</span>
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
                      <span className={"text-[10px] uppercase tracking-wider " + muted}>Banca %</span>
                      <input
                        type="number"
                        value={banca}
                        onChange={(e) => setBanca(e.target.value)}
                        className={field + " mt-0.5"}
                      />
                    </label>
                  </div>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 text-red-500">
                  <AlertCircle className="h-3.5 w-3.5" /> {feedResult.error}
                  {feedResult.betId && <span className={muted}>(id: {feedResult.betId})</span>}
                </div>
              )}
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
              <>
                <Sparkles className="h-4 w-4" /> Buscar aposta
              </>
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
