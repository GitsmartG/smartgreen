import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Search, Users, RefreshCw, AlertCircle, Shirt } from "lucide-react";
import { useIsDark } from "@/hooks/use-is-dark";
import { getMatchesByDate } from "@/lib/daily-matches.functions";
import type { NormalizedMatch } from "@/lib/daily-matches.server";
import {
  getMatchLineups,
  type LineupsResult,
  type TeamLineup,
  type LineupPlayer,
  type SidelinedPlayer,
} from "@/lib/statpal-lineups.functions";

export const Route = createFileRoute("/dashboard/escalacoes")({
  component: EscalacoesPage,
});

type MatchWithLeague = NormalizedMatch & { leagueName: string; country: string };

function EscalacoesPage() {
  const isDark = useIsDark();
  const fetchByDate = useServerFn(getMatchesByDate);
  const fetchLineups = useServerFn(getMatchLineups);

  const [matches, setMatches] = useState<MatchWithLeague[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<MatchWithLeague | null>(null);
  const [lineups, setLineups] = useState<LineupsResult | null>(null);
  const [loadingLineups, setLoadingLineups] = useState(false);

  const loadList = useCallback(async () => {
    setLoadingList(true);
    setListError(null);
    try {
      const res = await fetchByDate({ data: { date: "today" } });
      if (!res.ok || !res.payload) {
        setListError(res.error || "Erro ao carregar jogos");
        setMatches([]);
      } else {
        const all: MatchWithLeague[] = [];
        for (const lg of res.payload.leagues ?? []) {
          for (const m of lg.matches ?? []) {
            all.push({ ...m, leagueName: lg.name, country: lg.country });
          }
        }
        setMatches(all);
      }
    } catch (e) {
      setListError(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoadingList(false);
    }
  }, [fetchByDate]);

  useEffect(() => { void loadList(); }, [loadList]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return matches;
    return matches.filter((m) =>
      `${m.home.name} ${m.away.name} ${m.leagueName}`.toLowerCase().includes(q),
    );
  }, [matches, query]);

  const openMatch = useCallback(async (m: MatchWithLeague) => {
    setSelected(m);
    setLineups(null);
    if (!m.id) {
      setLineups({ ok: false, error: "Jogo sem ID válido" });
      return;
    }
    setLoadingLineups(true);
    try {
      const res = await fetchLineups({ data: { matchId: m.id } });
      setLineups(res);
    } catch (e) {
      setLineups({ ok: false, error: e instanceof Error ? e.message : "Erro" });
    } finally {
      setLoadingLineups(false);
    }
  }, [fetchLineups]);

  const panel = isDark ? "bg-neutral-900 border-neutral-800" : "bg-white border-neutral-200";
  const text = isDark ? "text-neutral-100" : "text-neutral-900";
  const muted = isDark ? "text-neutral-400" : "text-neutral-500";
  const subtle = isDark ? "bg-neutral-800/50 border-neutral-800" : "bg-neutral-50 border-neutral-200";

  return (
    <div className="space-y-4">
      <div className={`rounded-xl border ${panel} p-4 flex flex-col md:flex-row md:items-center gap-3`}>
        <div className="flex items-center gap-2 flex-1">
          <Search className={`h-4 w-4 ${muted}`} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar time, liga..."
            className={`w-full bg-transparent outline-none text-sm ${text}`}
          />
        </div>
        <button
          onClick={() => void loadList()}
          className={`flex items-center gap-2 px-3 py-2 rounded-md border text-sm ${subtle} ${text} hover:opacity-80`}
        >
          <RefreshCw className={`h-4 w-4 ${loadingList ? "animate-spin" : ""}`} />
          Atualizar
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-4">
        {/* Match list */}
        <div className={`rounded-xl border ${panel} overflow-hidden`}>
          <div className={`px-4 py-3 border-b ${isDark ? "border-neutral-800" : "border-neutral-200"} text-sm font-semibold`}>
            Jogos de hoje ({filtered.length})
          </div>
          <div className="max-h-[70vh] overflow-y-auto divide-y divide-neutral-800/40">
            {loadingList ? (
              <div className={`p-6 flex items-center gap-2 ${muted}`}>
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
              </div>
            ) : listError ? (
              <div className="p-6 flex items-center gap-2 text-red-500">
                <AlertCircle className="h-4 w-4" /> {listError}
              </div>
            ) : filtered.length === 0 ? (
              <div className={`p-6 text-sm ${muted}`}>Nenhum jogo encontrado.</div>
            ) : (
              filtered.map((m) => {
                const active = selected?.id === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => void openMatch(m)}
                    className={`w-full text-left px-4 py-3 flex flex-col gap-1 transition-colors ${
                      active
                        ? isDark ? "bg-neutral-800" : "bg-neutral-100"
                        : isDark ? "hover:bg-neutral-800/60" : "hover:bg-neutral-50"
                    }`}
                  >
                    <div className={`text-[11px] uppercase tracking-wide ${muted}`}>
                      {m.leagueName} · {m.country}
                    </div>
                    <div className={`text-sm font-medium ${text}`}>
                      {m.home.name} <span className={muted}>vs</span> {m.away.name}
                    </div>
                    <div className={`text-[11px] ${muted}`}>{m.status || m.kickoffLocal || ""}</div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Lineup panel */}
        <div className={`rounded-xl border ${panel} p-4 min-h-[300px]`}>
          {!selected ? (
            <div className={`h-full flex flex-col items-center justify-center gap-2 ${muted} text-sm py-16`}>
              <Users className="h-8 w-8 opacity-50" />
              Selecione um jogo pra ver a escalação
            </div>
          ) : loadingLineups ? (
            <div className={`flex items-center gap-2 ${muted} p-6`}>
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando escalação...
            </div>
          ) : !lineups?.ok ? (
            <div className="space-y-3">
              <MatchHeader match={selected} isDark={isDark} />
              <div className="flex items-center gap-2 text-sm text-amber-500 bg-amber-500/10 border border-amber-500/30 rounded-md p-3">
                <AlertCircle className="h-4 w-4" />
                {lineups?.error || "Escalação indisponível"}
              </div>
              <p className={`text-xs ${muted}`}>
                Escalações costumam sair ~1h antes do jogo. Ligas menores podem não ter cobertura.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <MatchHeader match={selected} isDark={isDark} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TeamPanel label={selected.home.name} team={lineups.home} isDark={isDark} />
                <TeamPanel label={selected.away.name} team={lineups.away} isDark={isDark} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MatchHeader({ match, isDark }: { match: MatchWithLeague; isDark: boolean }) {
  const muted = isDark ? "text-neutral-400" : "text-neutral-500";
  return (
    <div>
      <div className={`text-[11px] uppercase tracking-wide ${muted}`}>
        {match.leagueName} · {match.country}
      </div>
      <div className="text-base font-semibold">
        {match.home.name} <span className={muted}>vs</span> {match.away.name}
      </div>
    </div>
  );
}

function TeamPanel({
  label,
  team,
  isDark,
}: {
  label: string;
  team?: TeamLineup;
  isDark: boolean;
}) {
  const panel = isDark ? "bg-neutral-800/40 border-neutral-800" : "bg-neutral-50 border-neutral-200";
  const muted = isDark ? "text-neutral-400" : "text-neutral-500";

  if (!team) {
    return (
      <div className={`rounded-lg border ${panel} p-3 text-sm ${muted}`}>
        Escalação de {label} não disponível.
      </div>
    );
  }

  return (
    <div className={`rounded-lg border ${panel} p-3 space-y-3`}>
      <div>
        <div className="text-sm font-semibold">{team.team_name || label}</div>
        <div className={`text-[11px] ${muted} flex flex-wrap gap-x-2`}>
          {team.team_formation && <span>Formação: {team.team_formation}</span>}
          {team.coach?.name && <span>· Técnico: {team.coach.name}</span>}
        </div>
      </div>

      <PlayerGroup title="Titulares" players={team.starting_xi} isDark={isDark} icon />
      <PlayerGroup title="Reservas" players={team.bench} isDark={isDark} />
      <SidelinedGroup players={team.sidelined} isDark={isDark} />
    </div>
  );
}

function PlayerGroup({
  title,
  players,
  isDark,
  icon,
}: {
  title: string;
  players?: LineupPlayer[];
  isDark: boolean;
  icon?: boolean;
}) {
  const muted = isDark ? "text-neutral-400" : "text-neutral-500";
  if (!players || players.length === 0) return null;
  return (
    <div>
      <div className={`text-[11px] uppercase tracking-wide ${muted} mb-1`}>{title}</div>
      <ul className="space-y-1">
        {players.map((p, i) => (
          <li key={`${p.id ?? i}-${p.name ?? i}`} className="flex items-center gap-2 text-sm">
            {icon && <Shirt className="h-3 w-3 opacity-60 shrink-0" />}
            <span className={`w-6 text-right tabular-nums ${muted}`}>{p.number ?? "-"}</span>
            <span className="flex-1 truncate">{p.name ?? "—"}</span>
            {p.position && <span className={`text-[10px] ${muted}`}>{p.position}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SidelinedGroup({ players, isDark }: { players?: SidelinedPlayer[]; isDark: boolean }) {
  const muted = isDark ? "text-neutral-400" : "text-neutral-500";
  if (!players || players.length === 0) return null;
  return (
    <div>
      <div className={`text-[11px] uppercase tracking-wide ${muted} mb-1`}>Desfalques</div>
      <ul className="space-y-1">
        {players.map((p, i) => (
          <li key={`${p.id ?? i}-${p.name ?? i}`} className="flex items-center gap-2 text-sm">
            <span className="flex-1 truncate">{p.name ?? "—"}</span>
            {p.status && <span className="text-[10px] text-amber-500">{p.status}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
