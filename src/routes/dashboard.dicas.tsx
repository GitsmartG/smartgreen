import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
};

const TICKETS: Ticket[] = [
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

  const [tab, setTab] = useState<Tab>("todos");
  const [query, setQuery] = useState("");
  const [esporte, setEsporte] = useState("todos");
  const [tipo, setTipo] = useState("todos");

  const counts = useMemo(() => {
    return {
      ao_vivo: TICKETS.filter((t) => t.status === "ao_vivo").length,
      green: TICKETS.filter((t) => t.status === "green").length,
      red: TICKETS.filter((t) => t.status === "red").length,
    };
  }, []);

  const filtered = useMemo(() => {
    return TICKETS.filter((t) => {
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
  }, [tab, tipo, esporte, query]);

  return (
    <div className="space-y-4">
      {/* Topo */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Tickets de Tips</h2>
          <p className={`text-xs ${muted} mt-0.5 flex items-center gap-2`}>
            <span>{TICKETS.length} tickets no total</span>
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
