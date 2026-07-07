import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { RefreshCw, AlertCircle, Search } from "lucide-react";
import { useIsDark } from "@/hooks/use-is-dark";
import { getTodayMatches, type DailyMatchesResult } from "@/lib/daily-matches.functions";
import type { NormalizedLeague, NormalizedMatch } from "@/lib/daily-matches.server";

export const Route = createFileRoute("/dashboard/jogos")({
  component: JogosHojePage,
});

type FilterKey = "todos" | "ao_vivo" | "encerrados" | "agendados";

function JogosHojePage() {
  const isDark = useIsDark();
  const [state, setState] = useState<{
    loading: boolean;
    data: DailyMatchesResult | null;
  }>({ loading: true, data: null });
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("todos");

  const load = async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const res = await getTodayMatches();
      setState({ loading: false, data: res });
    } catch (e) {
      setState({
        loading: false,
        data: { ok: false, cached: false, error: e instanceof Error ? e.message : "Erro" },
      });
    }
  };
  useEffect(() => {
    void load();
  }, []);

  const filteredLeagues = useMemo<NormalizedLeague[]>(() => {
    const leagues = state.data?.payload?.leagues ?? [];
    const q = query.trim().toLowerCase();
    return leagues
      .map((lg) => {
        const matches = lg.matches.filter((m) => {
          if (filter === "ao_vivo" && !m.live) return false;
          if (filter === "encerrados" && !m.finished) return false;
          if (filter === "agendados" && (m.live || m.finished)) return false;
          if (q) {
            const hay = `${m.home.name} ${m.away.name} ${lg.name} ${lg.country}`.toLowerCase();
            if (!hay.includes(q)) return false;
          }
          return true;
        });
        return { ...lg, matches };
      })
      .filter((lg) => lg.matches.length > 0);
  }, [state.data, query, filter]);

  const totalCount = state.data?.payload?.totalMatches ?? 0;
  const liveCount =
    state.data?.payload?.leagues.reduce(
      (sum, lg) => sum + lg.matches.filter((m) => m.live).length,
      0,
    ) ?? 0;
  const finishedCount =
    state.data?.payload?.leagues.reduce(
      (sum, lg) => sum + lg.matches.filter((m) => m.finished).length,
      0,
    ) ?? 0;

  const updatedTime = state.data?.fetchedAt
    ? new Date(state.data.fetchedAt).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZone: "America/Sao_Paulo",
      })
    : "--:--:--";

  // paleta terminal
  const surface = isDark ? "bg-[#0a0a0c]" : "bg-white";
  const textMain = isDark ? "text-slate-300" : "text-slate-700";
  const textStrong = isDark ? "text-white" : "text-slate-900";
  const textMuted = isDark ? "text-slate-500" : "text-slate-500";
  const textFaint = isDark ? "text-slate-600" : "text-slate-400";
  const chipBg = isDark ? "bg-white/5 border-white/10" : "bg-slate-100 border-slate-200";
  const inputBg = isDark
    ? "bg-white/5 border-white/10 text-slate-200 placeholder:text-slate-600 focus:border-emerald-500/50 focus:ring-emerald-500/40"
    : "bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-emerald-500/30";
  const filterInactive = isDark
    ? "text-slate-400 hover:text-white"
    : "text-slate-500 hover:text-slate-900";

  return (
    <div className={`${surface} ${textMain} font-['Inter'] -m-4 md:-m-6 p-4 md:p-6 min-h-full`}>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Terminal Header */}
        <header className="flex flex-col gap-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className="text-[10px] font-bold tracking-widest uppercase text-emerald-500">
                  Terminal Live Feed
                </span>
              </div>
              <h1 className={`text-3xl font-bold tracking-tight ${textStrong}`}>Jogos de Hoje</h1>
              <p className={`${textMuted} text-sm mt-1`}>
                Atualizado em{" "}
                <span className="font-['JetBrains_Mono']">{updatedTime}</span>
                {state.data?.cached ? (
                  <span className={`ml-2 text-[10px] uppercase tracking-widest ${textFaint}`}>
                    · cache
                  </span>
                ) : state.data ? (
                  <span className="ml-2 text-[10px] uppercase tracking-widest text-emerald-500">
                    · live
                  </span>
                ) : null}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className={`flex border rounded-lg p-1 ${chipBg}`}>
                <div className={`px-3 py-1.5 rounded-md ${isDark ? "bg-white/10" : "bg-slate-200"}`}>
                  <span className={`text-[10px] block uppercase font-bold ${textMuted}`}>Total</span>
                  <span className={`font-['JetBrains_Mono'] text-sm ${textStrong}`}>{totalCount}</span>
                </div>
                <div className="px-3 py-1.5">
                  <span className={`text-[10px] block uppercase font-bold ${textMuted}`}>Live</span>
                  <span className="font-['JetBrains_Mono'] text-sm text-amber-500">{liveCount}</span>
                </div>
                <div className="px-3 py-1.5">
                  <span className={`text-[10px] block uppercase font-bold ${textMuted}`}>Fim</span>
                  <span className={`font-['JetBrains_Mono'] text-sm ${textFaint}`}>{finishedCount}</span>
                </div>
              </div>
              <button
                onClick={() => void load()}
                disabled={state.loading}
                aria-label="Recarregar"
                className="h-12 w-12 flex items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/20 transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-5 h-5 ${state.loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1 group">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${textMuted} group-focus-within:text-emerald-500 transition-colors`} />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por liga, time ou país..."
                className={`w-full border rounded-xl py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-1 transition-all ${inputBg}`}
              />
            </div>
            <div className={`flex gap-1 border p-1 rounded-xl ${chipBg}`}>
              {(
                [
                  { key: "todos", label: "Todos" },
                  { key: "ao_vivo", label: "Ao Vivo" },
                  { key: "encerrados", label: "Encerrados" },
                  { key: "agendados", label: "Agendados" },
                ] as const
              ).map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={
                    "px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors " +
                    (filter === f.key
                      ? "bg-emerald-500 text-black"
                      : filterInactive)
                  }
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* States */}
        {state.loading && (
          <div className={`rounded-xl border p-12 text-center ${chipBg} ${textMuted}`}>
            <span className="font-['JetBrains_Mono'] text-xs uppercase tracking-widest">
              Carregando feed do dia...
            </span>
          </div>
        )}

        {!state.loading && state.data && !state.data.ok && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 text-red-500 text-sm p-4 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{state.data.error ?? "Erro ao carregar."}</span>
          </div>
        )}

        {!state.loading && state.data?.ok && filteredLeagues.length === 0 && (
          <div className={`rounded-xl border p-12 text-center ${chipBg} ${textMuted}`}>
            Nenhuma partida encontrada com esses filtros.
          </div>
        )}

        {/* Match Feed */}
        {!state.loading && filteredLeagues.length > 0 && (
          <div className="space-y-8">
            {filteredLeagues.map((lg) => (
              <LeagueSection key={lg.id || lg.name} league={lg} isDark={isDark} />
            ))}
          </div>
        )}

        {/* Footer legend */}
        <footer className={`pt-6 flex items-center justify-between text-[10px] uppercase font-bold tracking-widest border-t ${isDark ? "border-white/5 text-slate-600" : "border-slate-200 text-slate-400"} flex-wrap gap-3`}>
          <div className="flex gap-6 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Ao Vivo
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-sky-500" /> Agendado (Brasília)
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${isDark ? "bg-white/20" : "bg-slate-300"}`} /> Encerrado
            </div>
          </div>
          <div className="flex items-center gap-2">
            Sync auto 00:01 UTC · <span className="text-emerald-500">Operacional</span>
          </div>
        </footer>
      </div>
    </div>
  );
}

function LeagueSection({ league, isDark }: { league: NormalizedLeague; isDark: boolean }) {
  const headerBg = isDark ? "bg-[#0a0a0c]/85" : "bg-white/85";
  const textStrong = isDark ? "text-white" : "text-slate-900";
  const textMuted = isDark ? "text-slate-500" : "text-slate-500";
  const borderCol = isDark ? "border-white/10" : "border-slate-200";
  const gradientLine = isDark
    ? "bg-gradient-to-r from-white/10 to-transparent"
    : "bg-gradient-to-r from-slate-300 to-transparent";
  const countryLabel = league.country ? league.country.toUpperCase() : "";

  return (
    <section className="space-y-2">
      <div className={`flex items-center gap-3 px-2 py-1 sticky top-0 backdrop-blur-md z-10 ${headerBg}`}>
        <CountryChip code={countryLabel} isDark={isDark} />
        <h2 className={`text-sm font-bold tracking-wide uppercase ${textMuted}`}>
          {countryLabel && <span className="mr-1">{countryLabel}</span>}
          <span className={textStrong}>{league.name}</span>
        </h2>
        <div className={`flex-1 h-px ${gradientLine}`} />
        <span className={`text-[10px] font-['JetBrains_Mono'] ${textMuted}`}>
          {league.matches.length} {league.matches.length === 1 ? "jogo" : "jogos"}
        </span>
      </div>

      <div className={`space-y-px rounded-xl overflow-hidden border ${borderCol}`}>
        {league.matches.map((m) => (
          <MatchRow key={m.id} match={m} isDark={isDark} />
        ))}
      </div>
    </section>
  );
}

function CountryChip({ code, isDark }: { code: string; isDark: boolean }) {
  const short = code.slice(0, 3) || "?";
  return (
    <div
      className={
        "w-8 h-5 rounded-sm border flex items-center justify-center text-[8px] font-bold tracking-wider " +
        (isDark
          ? "bg-white/5 border-white/10 text-slate-400"
          : "bg-slate-100 border-slate-200 text-slate-500")
      }
    >
      {short}
    </div>
  );
}

function formatSpTime(date?: string, time?: string): string | undefined {
  if (!time) return undefined;
  const t = time.match(/^(\d{1,2}):(\d{2})/);
  if (!t) return time;
  const hh = t[1].padStart(2, "0");
  const mm = t[2];
  const d = date && /^\d{4}[-.]\d{2}[-.]\d{2}$/.test(date)
    ? date.replace(/\./g, "-")
    : new Date().toISOString().slice(0, 10);
  const iso = `${d}T${hh}:${mm}:00Z`;
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return time;
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(dt);
}

function TeamLogo({ id, name, isDark, dim }: { id?: string; name: string; isDark: boolean; dim?: boolean }) {
  const [broken, setBroken] = useState(false);
  const src = id ? `/api/public/team-image/${id}?type=team` : null;
  const dimCls = dim ? "opacity-60" : "";
  if (src && !broken) {
    return (
      <img
        src={src}
        alt={name}
        loading="lazy"
        onError={() => setBroken(true)}
        className={`h-7 w-7 rounded-full object-contain bg-white/90 border border-white/10 shrink-0 ${dimCls}`}
      />
    );
  }
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "?";
  return (
    <div
      className={
        `h-7 w-7 rounded-full border flex items-center justify-center text-[9px] font-bold shrink-0 ${dimCls} ` +
        (isDark
          ? "bg-white/5 border-white/10 text-slate-300"
          : "bg-slate-100 border-slate-200 text-slate-600")
      }
    >
      {initials}
    </div>
  );
}

function MatchRow({ match, isDark }: { match: NormalizedMatch; isDark: boolean }) {
  const spTime = formatSpTime(match.date, match.time);
  const status = match.live
    ? "live"
    : match.finished
      ? "finished"
      : "scheduled";

  const borderLeft =
    status === "live"
      ? "border-l-2 border-amber-500"
      : status === "scheduled"
        ? "border-l-2 border-sky-500/50"
        : isDark
          ? "border-l-2 border-white/10"
          : "border-l-2 border-slate-200";

  const rowBg = isDark
    ? "bg-white/[0.02] hover:bg-white/[0.05]"
    : "bg-slate-50 hover:bg-slate-100";
  const rowText = isDark ? "text-white" : "text-slate-900";
  const rowTextDim = isDark ? "text-slate-300" : "text-slate-700";
  const rowTextMuted = isDark ? "text-slate-500" : "text-slate-500";
  const scoreCell = isDark ? "bg-white/5" : "bg-slate-100";

  const statusLabel =
    status === "live"
      ? `${match.status || "AO VIVO"}`
      : status === "finished"
        ? "ENCERRADO"
        : spTime ?? "AGENDADO";

  const statusClass =
    status === "live"
      ? "text-amber-500 animate-pulse"
      : status === "scheduled"
        ? "text-sky-400"
        : rowTextMuted;

  const scoreColor =
    status === "live"
      ? "text-emerald-500"
      : status === "finished"
        ? rowText
        : rowTextMuted;

  return (
    <div
      className={`group grid grid-cols-[88px_1fr_72px_1fr] items-center transition-colors ${rowBg} ${borderLeft}`}
    >
      <div className="py-4 px-4 flex flex-col items-start">
        <span
          className={`text-[10px] font-bold font-['JetBrains_Mono'] uppercase tracking-tight ${statusClass}`}
        >
          {statusLabel}
        </span>
        {status === "scheduled" && spTime && (
          <span className={`text-[8px] mt-0.5 uppercase tracking-widest ${rowTextMuted}`}>
            Brasília
          </span>
        )}
      </div>

      <div className="flex items-center justify-end gap-3 pr-4 min-w-0">
        <span
          className={`text-sm font-semibold truncate text-right ${
            status === "finished" ? rowTextDim : rowText
          }`}
        >
          {match.home.name}
        </span>
        <TeamLogo
          id={match.home.id}
          name={match.home.name}
          isDark={isDark}
          dim={status === "finished"}
        />
      </div>

      <div className={`h-full flex items-center justify-center ${scoreCell}`}>
        {status === "scheduled" ? (
          <span className={`font-['JetBrains_Mono'] text-sm font-bold ${rowTextMuted}`}>VS</span>
        ) : (
          <span className={`font-['JetBrains_Mono'] text-lg font-bold tracking-widest ${scoreColor}`}>
            {(match.home.goals ?? 0)}-{(match.away.goals ?? 0)}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3 pl-4 min-w-0">
        <TeamLogo
          id={match.away.id}
          name={match.away.name}
          isDark={isDark}
          dim={status === "finished"}
        />
        <span
          className={`text-sm font-semibold truncate ${
            status === "finished" ? rowTextDim : rowText
          }`}
        >
          {match.away.name}
        </span>
      </div>
    </div>
  );
}
