import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, RefreshCw, AlertCircle, Radio, Trophy, Search } from "lucide-react";
import { useIsDark } from "@/hooks/use-is-dark";
import { getTodayMatches, type DailyMatchesResult } from "@/lib/daily-matches.functions";
import type { NormalizedLeague, NormalizedMatch } from "@/lib/daily-matches.server";

export const Route = createFileRoute("/dashboard/jogos")({
  component: JogosHojePage,
});

function JogosHojePage() {
  const isDark = useIsDark();
  const [state, setState] = useState<{
    loading: boolean;
    data: DailyMatchesResult | null;
  }>({ loading: true, data: null });
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"todos" | "ao_vivo" | "encerrados" | "agendados">("todos");

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

  const panel = isDark ? "bg-neutral-900 border-neutral-800" : "bg-white border-neutral-200";
  const inner = isDark ? "bg-neutral-950/60 border-neutral-800" : "bg-neutral-50 border-neutral-200";
  const muted = isDark ? "text-neutral-400" : "text-neutral-500";
  const subtle = isDark ? "text-neutral-500" : "text-neutral-500";

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

  return (
    <div className="space-y-4">
      {/* Topo */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Jogos de Hoje</h2>
          <p className={`text-xs ${muted} mt-0.5 flex items-center gap-2 flex-wrap`}>
            <span>{totalCount} partidas</span>
            <span>·</span>
            <span className="inline-flex items-center gap-1 text-amber-500">
              <Radio className="h-3 w-3" /> {liveCount} ao vivo
            </span>
            <span>·</span>
            <span>{finishedCount} encerradas</span>
            {state.data?.fetchedAt && (
              <>
                <span>·</span>
                <span>
                  Atualizado {new Date(state.data.fetchedAt).toLocaleString("pt-BR")}
                  {state.data.cached ? " (cache do dia)" : " (buscado agora)"}
                </span>
              </>
            )}
          </p>
        </div>
        <button
          onClick={() => void load()}
          disabled={state.loading}
          className={
            "h-10 px-4 rounded-md border text-sm font-medium inline-flex items-center gap-2 transition-colors disabled:opacity-60 " +
            (isDark
              ? "border-neutral-800 bg-neutral-900 text-neutral-200 hover:bg-neutral-800"
              : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50")
          }
        >
          <RefreshCw className={`h-4 w-4 ${state.loading ? "animate-spin" : ""}`} />
          Recarregar
        </button>
      </div>

      {/* Filtros */}
      <div className={`rounded-xl border p-4 ${panel}`}>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
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
              placeholder="Buscar por time, liga ou país..."
              className={
                "h-10 w-full rounded-md border pl-9 pr-3 text-sm outline-none transition-colors " +
                (isDark
                  ? "bg-neutral-950 border-neutral-800 text-neutral-100 placeholder:text-neutral-600 focus:border-emerald-600"
                  : "bg-white border-neutral-300 text-neutral-900 placeholder:text-neutral-400 focus:border-emerald-700")
              }
            />
          </div>
          <div className="flex gap-2 flex-wrap">
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
                  "h-10 px-3 rounded-md border text-xs font-semibold transition-colors " +
                  (filter === f.key
                    ? "bg-emerald-500 text-white border-emerald-500"
                    : isDark
                      ? "border-neutral-800 bg-neutral-950 text-neutral-300 hover:bg-neutral-800"
                      : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50")
                }
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {state.loading && (
        <div className={`rounded-xl border p-12 text-center ${panel} ${muted}`}>
          Carregando jogos do dia...
        </div>
      )}

      {!state.loading && state.data && !state.data.ok && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 text-red-500 text-sm p-4 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{state.data.error ?? "Erro ao carregar."}</span>
        </div>
      )}

      {!state.loading && state.data?.ok && filteredLeagues.length === 0 && (
        <div className={`rounded-xl border p-12 text-center ${panel} ${muted}`}>
          Nenhuma partida encontrada com esses filtros.
        </div>
      )}

      {!state.loading &&
        filteredLeagues.map((lg) => (
          <div key={lg.id || lg.name} className={`rounded-xl border ${panel} overflow-hidden`}>
            <div
              className={
                "flex items-center gap-2 px-4 py-3 border-b " +
                (isDark ? "border-neutral-800 bg-neutral-950/40" : "border-neutral-200 bg-neutral-50")
              }
            >
              <Trophy className="h-4 w-4 text-emerald-500" />
              <div className="font-semibold text-sm">{lg.name}</div>
              <span className={`text-[10px] uppercase tracking-wider ${subtle}`}>{lg.country}</span>
              <span
                className={
                  "ml-auto text-[10px] font-semibold rounded-full px-2 py-0.5 border " +
                  (isDark
                    ? "border-neutral-700 text-neutral-300 bg-neutral-800/60"
                    : "border-neutral-200 text-neutral-600 bg-neutral-100")
                }
              >
                {lg.matches.length} {lg.matches.length === 1 ? "jogo" : "jogos"}
              </span>
            </div>
            <ul className={`divide-y ${isDark ? "divide-neutral-800" : "divide-neutral-200"}`}>
              {lg.matches.map((m) => (
                <MatchRow key={m.id} match={m} inner={inner} isDark={isDark} muted={muted} />
              ))}
            </ul>
          </div>
        ))}

      <div className={`rounded-xl border p-3 text-[11px] ${panel} ${muted} flex items-start gap-2`}>
        <CalendarDays className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span>
          Dados atualizados automaticamente uma vez por dia às 00:01 (UTC). Use "Recarregar" para
          forçar uma nova busca se necessário.
        </span>
      </div>
    </div>
  );
}

function formatSpTime(date?: string, time?: string): string | undefined {
  if (!time) return undefined;
  // Statpal envia HH:MM em UTC. Se vier date, monta ISO; senão usa hoje UTC.
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

function TeamLogo({ id, name, isDark }: { id?: string; name: string; isDark: boolean }) {
  const [broken, setBroken] = useState(false);
  const src = id ? `/api/public/team-image/${id}?type=team` : null;
  if (src && !broken) {
    return (
      <img
        src={src}
        alt={name}
        loading="lazy"
        onError={() => setBroken(true)}
        className="h-6 w-6 rounded-full object-contain bg-white/90 border border-neutral-200 shrink-0"
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
        "h-6 w-6 rounded-full border flex items-center justify-center text-[9px] font-bold shrink-0 " +
        (isDark ? "bg-neutral-800 text-neutral-300 border-neutral-700" : "bg-neutral-100 text-neutral-600 border-neutral-200")
      }
    >
      {initials}
    </div>
  );
}

function MatchRow({
  match,
  inner,
  isDark,
  muted,
}: {
  match: NormalizedMatch;
  inner: string;
  isDark: boolean;
  muted: string;
}) {
  const statusPill = match.live
    ? "bg-amber-500/15 text-amber-500 border-amber-500/30"
    : match.finished
      ? "bg-neutral-500/15 text-neutral-400 border-neutral-500/30"
      : "bg-sky-500/15 text-sky-500 border-sky-500/30";
  const spTime = formatSpTime(match.date, match.time);
  const statusLabel = match.live
    ? `AO VIVO ${match.status}`
    : match.finished
      ? match.status
      : spTime ?? "AGENDADO";
  const showScore = match.finished || match.live;

  return (
    <li className={`px-4 py-3 flex items-center gap-3 ${inner.includes("bg-") ? "" : ""}`}>
      <div className="w-20 shrink-0 text-center">
        <span className={`text-[10px] font-semibold px-2 py-1 rounded-full border ${statusPill}`}>
          {statusLabel}
        </span>
        {!match.live && !match.finished && spTime && (
          <div className={`text-[9px] mt-0.5 ${muted}`}>Brasília</div>
        )}
      </div>
      <div className="flex-1 min-w-0 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="flex items-center gap-2 justify-end min-w-0">
          <div className="text-sm font-medium truncate text-right">{match.home.name}</div>
          <TeamLogo id={match.home.id} name={match.home.name} isDark={isDark} />
        </div>
        <div className="text-lg font-bold tabular-nums min-w-[54px] text-center">
          {showScore ? (
            <>
              <span className={match.finished ? "" : "text-emerald-500"}>{match.home.goals ?? 0}</span>
              <span className={`mx-1 ${muted}`}>-</span>
              <span className={match.finished ? "" : "text-emerald-500"}>{match.away.goals ?? 0}</span>
            </>
          ) : (
            <span className={`text-xs font-semibold ${muted}`}>vs</span>
          )}
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <TeamLogo id={match.away.id} name={match.away.name} isDark={isDark} />
          <div className="text-sm font-medium truncate">{match.away.name}</div>
        </div>
      </div>
      {match.venue && (
        <div className={`hidden lg:block text-[11px] max-w-[180px] truncate ${muted}`}>
          {match.venue}
        </div>
      )}
    </li>
  );
}
