import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  RefreshCw,
  AlertCircle,
  Search,
  Sparkles,
  X,
  Loader2,
  Radio,
  Calendar,
  CheckCircle2,
  Users,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useIsDark } from "@/hooks/use-is-dark";
import { getLiveMatches, getMatchesByDate, type DailyMatchesResult } from "@/lib/daily-matches.functions";

import type { DailyMatchesPayload, NormalizedLeague, NormalizedMatch } from "@/lib/daily-matches.server";
import { getMatchPrediction, type PredictionResult } from "@/lib/statpal-prediction.functions";
import {
  getMatchLineups,
  type LineupsResult,
  type TeamLineup,
  type LineupPlayer,
  type SidelinedPlayer,
} from "@/lib/statpal-lineups.functions";

export const Route = createFileRoute("/dashboard/jogos")({
  component: JogosHojePage,
});

type FilterKey = "todos" | "ao_vivo" | "encerrados" | "agendados";

const LEAGUE_PRIORITY: { test: RegExp; rank: number }[] = [
  { test: /(uefa\s+)?champions\s+league|liga\s+dos\s+campeoes/i, rank: 0 },
  { test: /copa\s+libertadores|libertadores/i, rank: 1 },
  { test: /copa\s+sul[- ]?americana|sudamericana/i, rank: 2 },
  { test: /uefa\s+europa\s+league|europa\s+league/i, rank: 3 },
  { test: /uefa\s+nations\s+league|nations\s+league/i, rank: 4 },
  { test: /world\s+cup|copa\s+do\s+mundo|fifa/i, rank: 5 },
  { test: /brasileirao|brasileir[aã]o|serie\s+a\s+brasil|brazil.*serie\s+a/i, rank: 10 },
  { test: /copa\s+do\s+brasil/i, rank: 11 },
  { test: /premier\s+league|england.*premier/i, rank: 20 },
  { test: /la\s*liga|spain.*primera|primera\s+division/i, rank: 21 },
  { test: /serie\s+a(?!.*brasil)|italy.*serie\s+a/i, rank: 22 },
  { test: /bundesliga/i, rank: 23 },
  { test: /ligue\s*1/i, rank: 24 },
  { test: /copa\s+america|eurocopa|euro\s+championship/i, rank: 25 },
  { test: /serie\s+b.*brasil|brazil.*serie\s+b/i, rank: 30 },
];

const LIVE_REFRESH_INTERVAL_MS = 10_000;
const FULL_REFRESH_INTERVAL_MS = 60_000;

const COUNTRY_PRIORITY: Record<string, number> = {
  brazil: 40,
  brasil: 40,
  england: 45,
  spain: 46,
  italy: 47,
  germany: 48,
  france: 49,
  argentina: 50,
  portugal: 55,
  netherlands: 56,
  usa: 60,
};

function leaguePriority(lg: NormalizedLeague): number {
  const name = lg.name || "";
  for (const { test, rank } of LEAGUE_PRIORITY) {
    if (test.test(name)) return rank;
  }
  const country = (lg.country || "").toLowerCase();
  return COUNTRY_PRIORITY[country] ?? 100;
}

function normalizeKey(s: unknown): string {
  const str = typeof s === "string" ? s : s == null ? "" : typeof s === "number" || typeof s === "boolean" ? String(s) : "";
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function matchKey(m: NormalizedMatch): string {
  return `${normalizeKey(m.home?.name)}::${normalizeKey(m.away?.name)}`;
}

function mergeMatch(base: NormalizedMatch, live: NormalizedMatch): NormalizedMatch {
  return {
    ...base,
    ...live,
    home: { ...base.home, ...live.home, image: live.home.image ?? base.home.image, id: live.home.id ?? base.home.id },
    away: { ...base.away, ...live.away, image: live.away.image ?? base.away.image, id: live.away.id ?? base.away.id },
  };
}

function mergeLivePayload(base: DailyMatchesPayload | undefined, live: DailyMatchesPayload): DailyMatchesPayload {
  if (!base) return live;
  const leagues = (base.leagues ?? []).map((lg) => ({ ...lg, matches: [...(lg.matches ?? [])] }));
  const byId = new Map<string, { leagueIndex: number; matchIndex: number }>();
  const byTeams = new Map<string, { leagueIndex: number; matchIndex: number }>();

  leagues.forEach((lg, leagueIndex) => {
    lg.matches.forEach((m, matchIndex) => {
      byId.set(m.id, { leagueIndex, matchIndex });
      for (const alt of m.alternateIds ?? []) byId.set(alt, { leagueIndex, matchIndex });
      byTeams.set(matchKey(m), { leagueIndex, matchIndex });
    });
  });

  for (const liveLeague of live.leagues ?? []) {
    let targetLeagueIndex = leagues.findIndex(
      (lg) => lg.id === liveLeague.id || normalizeKey(`${lg.name} ${lg.country}`) === normalizeKey(`${liveLeague.name} ${liveLeague.country}`),
    );
    if (targetLeagueIndex < 0) {
      leagues.push({ ...liveLeague, matches: [] });
      targetLeagueIndex = leagues.length - 1;
    }

    for (const liveMatch of liveLeague.matches ?? []) {
      const found =
        byId.get(liveMatch.id) ||
        (liveMatch.alternateIds ?? []).map((id) => byId.get(id)).find(Boolean) ||
        byTeams.get(matchKey(liveMatch));
      if (found) {
        leagues[found.leagueIndex].matches[found.matchIndex] = mergeMatch(
          leagues[found.leagueIndex].matches[found.matchIndex],
          liveMatch,
        );
      } else {
        leagues[targetLeagueIndex].matches.push(liveMatch);
      }
    }
  }

  return {
    updated: live.updated ?? base.updated,
    updatedTs: live.updatedTs ?? base.updatedTs,
    leagues,
    totalMatches: leagues.reduce((sum, lg) => sum + (lg.matches?.length ?? 0), 0),
  };
}

function s(v: unknown, fb = ""): string {
  if (v == null) return fb;
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return fb;
}
function sNum(v: unknown, fb = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return fb;
}

function formatSpTime(_date?: string, time?: string): string | undefined {
  // A Statpal já devolve o horário do jogo no fuso do calendário consultado
  // (America/Sao_Paulo, definido no todayISO do server). Não reconverter —
  // reconverter causa jogos das 15h aparecerem como 12h.
  if (!time) return undefined;
  const t = time.match(/^(\d{1,2}):(\d{2})/);
  if (!t) return time;
  return `${t[1].padStart(2, "0")}:${t[2]}`;
}

// Deriva minutagem a partir do horário de início (SP) quando o feed diário
// não devolve o minuto corrente (só "LIVE"/"1H"/"2H" sem número).
function deriveMinuteFromKickoff(date?: string, time?: string, half?: "1H" | "2H"): string | undefined {
  if (!time) return undefined;
  const t = time.match(/^(\d{1,2}):(\d{2})/);
  if (!t) return undefined;
  const now = new Date();
  const spNow = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const kickoff = new Date(spNow);
  kickoff.setHours(Number(t[1]), Number(t[2]), 0, 0);
  let elapsedMin = Math.floor((spNow.getTime() - kickoff.getTime()) / 60000);
  if (elapsedMin < 0 || elapsedMin > 140) return undefined;
  if (half === "2H" && elapsedMin < 45) elapsedMin = 46;
  if (half === "1H" && elapsedMin > 45) elapsedMin = 45;
  if (elapsedMin > 45 && elapsedMin < 60) return "INTERVALO";
  const minute = elapsedMin < 60 ? elapsedMin : Math.min(elapsedMin - 15, 90);
  return `${Math.max(1, minute)}'`;
}

const BR_TZ_STR = "America/Sao_Paulo";
function brTodayISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BR_TZ_STR,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}
function diffDays(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(ay, am - 1, ad) - Date.UTC(by, bm - 1, bd)) / 86_400_000);
}
function formatDateBR(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).format(new Date(Date.UTC(y, m - 1, d, 12)));
}

function JogosHojePage() {


  const isDark = useIsDark();
  const fetchByDate = useServerFn(getMatchesByDate);
  const fetchLiveMatches = useServerFn(getLiveMatches);

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

  const [state, setState] = useState<{
    loading: boolean;
    data: DailyMatchesResult | null;
  }>({ loading: true, data: null });
  const [liveRefreshing, setLiveRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("todos");
  const [predictionMatch, setPredictionMatch] = useState<NormalizedMatch | null>(null);
  const [lineupsMatch, setLineupsMatch] = useState<NormalizedMatch | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(() => brTodayISO());

  const today = brTodayISO();
  const offsetFromToday = diffDays(selectedDate, today);
  const isToday = offsetFromToday === 0;

  const load = useCallback(async (opts?: { silent?: boolean; date?: string }) => {
    const d = opts?.date ?? selectedDate;
    if (!opts?.silent) setState((s) => ({ ...s, loading: true }));
    try {
      const res = await fetchByDate({ data: { date: d } });
      setState({ loading: false, data: res });
    } catch (e) {
      if (opts?.silent) return;
      setState({
        loading: false,
        data: { ok: false, cached: false, error: e instanceof Error ? e.message : "Erro" },
      });
    }
  }, [fetchByDate, selectedDate]);

  const refreshLive = useCallback(async () => {
    setLiveRefreshing(true);
    try {
      const live = await fetchLiveMatches({ data: { nonce: Date.now() } });
      if (!live.ok || !live.payload) return;
      const livePayload = live.payload;
      setState((cur) => ({
        loading: false,
        data: {
          ok: true,
          cached: false,
          date: cur.data?.date,
          fetchedAt: live.fetchedAt ?? new Date().toISOString(),
          payload: mergeLivePayload(cur.data?.payload, livePayload),
        },
      }));
    } catch {
      // mantém o último snapshot bom
    } finally {
      setLiveRefreshing(false);
    }
  }, [fetchLiveMatches]);

  useEffect(() => {
    void load();
    if (!isToday) return; // datas passadas/futuras não precisam de auto-refresh
    const liveId = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      void refreshLive();
    }, LIVE_REFRESH_INTERVAL_MS);
    const fullId = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      void load({ silent: true });
    }, FULL_REFRESH_INTERVAL_MS);
    const onVis = () => {
      if (!document.hidden) void refreshLive();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(liveId);
      clearInterval(fullId);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [load, refreshLive, isToday]);


  const filteredLeagues = useMemo<NormalizedLeague[]>(() => {
    const leagues = state.data?.payload?.leagues ?? [];
    const q = query.trim().toLowerCase();
    return leagues
      .map((lg) => {
        const matches = (lg.matches ?? []).filter((m) => {
          if (filter === "ao_vivo" && !m.live) return false;
          if (filter === "encerrados" && !m.finished) return false;
          if (filter === "agendados" && (m.live || m.finished)) return false;
          // "todos" esconde encerrados — quem quer ver encerrado usa a aba própria.
          if (filter === "todos" && m.finished) return false;
          if (q) {
            const hay = `${m.home?.name ?? ""} ${m.away?.name ?? ""} ${lg.name} ${lg.country}`.toLowerCase();
            if (!hay.includes(q)) return false;
          }
          return true;
        });
        return { ...lg, matches };
      })
      .filter((lg) => (lg.matches?.length ?? 0) > 0)
      .sort((a, b) => {
        const pa = leaguePriority(a);
        const pb = leaguePriority(b);
        if (pa !== pb) return pa - pb;
        return s(a.name, "").localeCompare(s(b.name, ""));
      });
  }, [state.data, query, filter]);

  const totalCount = state.data?.payload?.totalMatches ?? 0;
  const allMatches = (state.data?.payload?.leagues ?? []).flatMap((lg) => lg.matches ?? []);
  const liveCount = allMatches.filter((m) => m.live).length;
  const finishedCount = allMatches.filter((m) => m.finished).length;

  const updatedTime = state.data?.fetchedAt
    ? new Date(state.data.fetchedAt).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZone: "America/Sao_Paulo",
      })
    : "--:--";

  return (
    <div className="space-y-4">
      {/* Topo */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            {isToday ? "Jogos de Hoje" : offsetFromToday === -1 ? "Jogos de Ontem" : offsetFromToday === 1 ? "Jogos de Amanhã" : `Jogos · ${formatDateBR(selectedDate)}`}
          </h2>

          <p className={`text-xs ${muted} mt-0.5 flex items-center gap-2 flex-wrap`}>
            <span>{totalCount} jogos no total</span>
            <span>·</span>
            <span className="inline-flex items-center gap-1 text-emerald-500">
              <Radio className="h-3 w-3" /> Feed ao vivo
            </span>
            <span>·</span>
            <span>Atualizado {updatedTime}</span>
            {liveRefreshing ? (
              <span className="inline-flex items-center gap-1 text-emerald-500">
                <RefreshCw className="h-3 w-3 animate-spin" /> ao vivo
              </span>
            ) : null}
            {state.data?.cached ? (
              <span className={subtle}>(cache)</span>
            ) : null}
          </p>
        </div>
        <div className="flex items-center gap-2">
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
            {state.loading ? "Atualizando..." : "Atualizar"}
          </button>
        </div>
      </div>

      {/* Tabs de status */}
      <div className="flex flex-wrap gap-2">
        <StatusTab
          active={filter === "ao_vivo"}
          onClick={() => setFilter(filter === "ao_vivo" ? "todos" : "ao_vivo")}
          color="amber"
          isDark={isDark}
        >
          <Radio className="h-3.5 w-3.5" /> Ao Vivo ({liveCount})
        </StatusTab>
        <StatusTab
          active={filter === "agendados"}
          onClick={() => setFilter(filter === "agendados" ? "todos" : "agendados")}
          color="sky"
          isDark={isDark}
        >
          <Calendar className="h-3.5 w-3.5" /> Agendados
        </StatusTab>
        <StatusTab
          active={filter === "encerrados"}
          onClick={() => setFilter(filter === "encerrados" ? "todos" : "encerrados")}
          color="neutral"
          isDark={isDark}
        >
          <CheckCircle2 className="h-3.5 w-3.5" /> Encerrados ({finishedCount})
        </StatusTab>
      </div>

      {/* Filtro de busca */}
      <div className={`rounded-xl border p-4 ${panel}`}>
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
            placeholder="Buscar por liga, time ou país..."
            className={inputCls}
          />
        </div>
      </div>

      {/* Estados */}
      {state.loading && (
        <div className={`rounded-xl border p-12 text-center ${panel} ${muted}`}>
          Carregando jogos do dia...
        </div>
      )}

      {!state.loading && state.data && !state.data.ok && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 text-red-500 text-sm p-4 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            {typeof state.data.error === "string" ? state.data.error : "Erro ao carregar."}
          </span>
        </div>
      )}

      {!state.loading && state.data?.ok && filteredLeagues.length === 0 && (
        <div className={`rounded-xl border p-12 text-center ${panel} ${muted}`}>
          Nenhuma partida encontrada com esses filtros.
        </div>
      )}

      {/* Lista */}
      {!state.loading && filteredLeagues.length > 0 && (
        <div className="space-y-4">
          {filteredLeagues.map((lg, leagueIndex) => (
            <LeagueSection
              key={`${lg.id || lg.name}-${leagueIndex}`}
              league={lg}
              isDark={isDark}
              onPredict={setPredictionMatch}
              onLineups={setLineupsMatch}
              panel={panel}
              muted={muted}
              subtle={subtle}
            />
          ))}
        </div>
      )}

      {predictionMatch && (
        <PredictionModal
          match={predictionMatch}
          isDark={isDark}
          onClose={() => setPredictionMatch(null)}
        />
      )}

      {lineupsMatch && (
        <LineupsModal
          match={lineupsMatch}
          isDark={isDark}
          onClose={() => setLineupsMatch(null)}
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
  color: "amber" | "sky" | "neutral";
  isDark: boolean;
  children: React.ReactNode;
}) {
  const colorMap = {
    amber: "text-amber-500 border-amber-500/40 bg-amber-500/10",
    sky: "text-sky-500 border-sky-500/40 bg-sky-500/10",
    neutral: isDark
      ? "text-neutral-300 border-neutral-700 bg-neutral-800/40"
      : "text-neutral-700 border-neutral-300 bg-neutral-100",
  } as const;
  const inactive = isDark
    ? "text-neutral-400 border-neutral-800 bg-neutral-900 hover:bg-neutral-800"
    : "text-neutral-600 border-neutral-200 bg-white hover:bg-neutral-50";
  return (
    <button
      onClick={onClick}
      className={
        "h-9 px-3 rounded-md border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors " +
        (active ? colorMap[color] : inactive)
      }
    >
      {children}
    </button>
  );
}

function LeagueSection({
  league,
  isDark,
  onPredict,
  onLineups,
  panel,
  muted,
  subtle,
}: {
  league: NormalizedLeague;
  isDark: boolean;
  onPredict: (m: NormalizedMatch) => void;
  onLineups: (m: NormalizedMatch) => void;
  panel: string;
  muted: string;
  subtle: string;
}) {
  const divider = isDark ? "divide-neutral-800" : "divide-neutral-200";
  const countryLabel = league.country ? league.country.toUpperCase() : "";

  return (
    <section className={`rounded-xl border ${panel} overflow-hidden`}>
      <header
        className={
          "flex items-center gap-3 px-4 py-2.5 border-b " +
          (isDark ? "border-neutral-800 bg-neutral-950/40" : "border-neutral-200 bg-neutral-50")
        }
      >
        {countryLabel && (
          <span
            className={
              "text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded border " +
              (isDark
                ? "border-neutral-800 text-neutral-400 bg-neutral-900"
                : "border-neutral-300 text-neutral-500 bg-white")
            }
          >
            {countryLabel.slice(0, 3)}
          </span>
        )}
          <h3 className="text-sm font-semibold flex-1 min-w-0 truncate">
          {s(league.name, "Liga")}
        </h3>
        <span className={`text-[11px] ${subtle}`}>
          {(league.matches?.length ?? 0)} {(league.matches?.length ?? 0) === 1 ? "jogo" : "jogos"}
        </span>
      </header>

      <div className={`divide-y ${divider}`}>
        {(league.matches ?? []).map((m, matchIndex) => (
          <MatchRow
            key={`${m.id || "match"}-${matchIndex}-${m.home.name}-${m.away.name}`}
            match={m}
            isDark={isDark}
            onPredict={onPredict}
            onLineups={onLineups}
            muted={muted}
          />
        ))}
      </div>
    </section>
  );
}

function TeamLogo({
  id,
  logo,
  name,
  isDark,
  dim,
}: {
  id?: string;
  logo?: string;
  name: string;
  isDark: boolean;
  dim?: boolean;
}) {
  const [broken, setBroken] = useState(false);
  const dimCls = dim ? "opacity-60" : "";
  // Prioridade: URL absoluta do payload → proxy Statpal por id (que já cai
  // num SVG de escudo se a API não tiver imagem, então sempre renderiza).
  const src =
    logo && /^https?:\/\//i.test(logo)
      ? logo
      : id
        ? `/api/public/team-image/${encodeURIComponent(id)}?type=team`
        : null;
  if (src && !broken) {
    return (
      <img
        src={src}
        alt={name}
        loading="lazy"
        onError={() => setBroken(true)}
        className={`h-6 w-6 object-contain shrink-0 ${dimCls}`}
      />
    );
  }
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "?";
  // hash simples pra dar uma cor consistente por time
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  const hue = Math.abs(hash) % 360;
  const bg = isDark
    ? `hsl(${hue} 40% 22%)`
    : `hsl(${hue} 55% 92%)`;
  const fg = isDark
    ? `hsl(${hue} 65% 78%)`
    : `hsl(${hue} 55% 30%)`;
  return (
    <div
      className={
        `h-6 w-6 rounded-full border flex items-center justify-center text-[9px] font-bold shrink-0 ${dimCls} ` +
        (isDark ? "border-neutral-700" : "border-neutral-200")
      }
      style={{ background: bg, color: fg }}
    >
      {initials}
    </div>
  );
}

function MatchRow({
  match,
  isDark,
  onPredict,
  onLineups,
  muted,
}: {
  match: NormalizedMatch;
  isDark: boolean;
  onPredict: (m: NormalizedMatch) => void;
  onLineups: (m: NormalizedMatch) => void;
  muted: string;
}) {
  const spTime = formatSpTime(match.date, match.time);
  const status = match.live ? "live" : match.finished ? "finished" : "scheduled";
  const rawStatus = s(match.status, "").toUpperCase().trim();
  const isHalftime = rawStatus === "HT" || rawStatus === "BREAK";

  // Formata minutagem: "45+2'", "78", "1H" -> "45'+2", "78'", "1º T"
  let liveLabel = "AO VIVO";
  if (status === "live") {
    if (isHalftime) liveLabel = "INTERVALO";
    else if (/^\d{1,3}(\+\d+)?'?$/.test(rawStatus)) {
      const clean = rawStatus.replace(/'/g, "");
      const [base, extra] = clean.split("+");
      liveLabel = extra ? `${base}'+${extra}` : `${base}'`;
    } else if (rawStatus === "1H") {
      const d = deriveMinuteFromKickoff(match.date, match.time, "1H");
      liveLabel = d ?? "1º TEMPO";
    } else if (rawStatus === "2H") {
      const d = deriveMinuteFromKickoff(match.date, match.time, "2H");
      liveLabel = d ?? "2º TEMPO";
    } else if (rawStatus === "ET") liveLabel = "PRORROG.";
    else if (rawStatus && rawStatus !== "LIVE" && rawStatus !== "INPLAY") {
      liveLabel = rawStatus;
    } else {
      // Feed diário não trouxe o minuto — deriva pelo horário de início (SP).
      const d = deriveMinuteFromKickoff(match.date, match.time);
      if (d) liveLabel = d;
    }
  }

  const rowHover = isDark ? "hover:bg-neutral-800/40" : "hover:bg-neutral-50";
  const scoreBg = isDark ? "bg-neutral-950/60 border-neutral-800" : "bg-neutral-50 border-neutral-200";

  const statusClass =
    status === "live"
      ? isHalftime
        ? "text-amber-500"
        : "text-red-500"
      : status === "scheduled"
        ? "text-sky-500"
        : muted;

  const scoreColor =
    status === "live"
      ? "text-emerald-500"
      : status === "finished"
        ? ""
        : muted;

  return (
    <div
      className={`grid grid-cols-[80px_1fr_64px_1fr_84px] items-center gap-2 px-3 py-2.5 transition-colors ${rowHover}`}
    >
      <div className="flex flex-col">
        {status === "live" ? (
          <span className={`text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1 ${statusClass}`}>
            {!isHalftime && (
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75 animate-ping" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
              </span>
            )}
            {liveLabel}
          </span>
        ) : (
          <span className={`text-[10px] font-bold uppercase tracking-wider ${statusClass}`}>
            {status === "finished" ? "ENCERRADO" : spTime ?? "AGENDADO"}
          </span>
        )}
        {status === "scheduled" && spTime && (
          <span className={`text-[9px] mt-0.5 ${muted}`}>Brasília</span>
        )}
      </div>


      <div className="flex items-center justify-end gap-2 min-w-0">
        <span
          className={`text-sm font-medium truncate text-right ${
            status === "finished" ? muted : ""
          }`}
        >
          {s(match.home.name, "?")}
        </span>
        <TeamLogo
          id={s(match.home.id) || undefined}
          logo={s(match.home.image) || undefined}
          name={s(match.home.name, "?")}
          isDark={isDark}
          dim={status === "finished"}
        />
      </div>

      <div className={`h-9 rounded-md border flex items-center justify-center ${scoreBg}`}>
        {status === "scheduled" ? (
          <span className={`text-xs font-semibold ${muted}`}>VS</span>
        ) : (
          <span className={`text-base font-bold tabular-nums ${scoreColor}`}>
            {sNum(match.home.goals, 0)}-{sNum(match.away.goals, 0)}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 min-w-0">
        <TeamLogo
          id={s(match.away.id) || undefined}
          logo={s(match.away.image) || undefined}
          name={s(match.away.name, "?")}
          isDark={isDark}
          dim={status === "finished"}
        />
        <span
          className={`text-sm font-medium truncate ${
            status === "finished" ? muted : ""
          }`}
        >
          {s(match.away.name, "?")}
        </span>
      </div>

      <div className="flex items-center justify-center gap-1">
        {status !== "finished" ? (
          <>
            <button
              type="button"
              onClick={() => onPredict(match)}
              title="Ver previsão do modelo"
              aria-label="Ver previsão"
              className={
                "h-8 w-8 flex items-center justify-center rounded-md border transition-colors " +
                (isDark
                  ? "border-neutral-800 bg-neutral-900 text-emerald-500 hover:bg-neutral-800"
                  : "border-neutral-200 bg-white text-emerald-600 hover:bg-neutral-50")
              }
            >
              <Sparkles className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onLineups(match)}
              title="Ver escalação"
              aria-label="Ver escalação"
              className={
                "h-8 w-8 flex items-center justify-center rounded-md border transition-colors " +
                (isDark
                  ? "border-neutral-800 bg-neutral-900 text-sky-400 hover:bg-neutral-800"
                  : "border-neutral-200 bg-white text-sky-600 hover:bg-neutral-50")
              }
            >
              <Users className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <span className={`text-[10px] ${muted}`}>—</span>
        )}
      </div>
    </div>
  );
}

function PredictionModal({
  match,
  isDark,
  onClose,
}: {
  match: NormalizedMatch;
  isDark: boolean;
  onClose: () => void;
}) {
  const fetchPrediction = useServerFn(getMatchPrediction);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<PredictionResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setResult(null);
    if (!match.id) {
      setResult({ ok: false, error: "Este jogo não tem ID no feed — sem previsão disponível." });
      setLoading(false);
      return;
    }
    fetchPrediction({ data: { matchId: match.id } })
      .then((r) => {
        if (!cancelled) {
          setResult(r);
          setLoading(false);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setResult({ ok: false, error: e instanceof Error ? e.message : "Erro" });
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [fetchPrediction, match.id]);

  const panel = isDark
    ? "bg-neutral-900 border-neutral-800 text-neutral-200"
    : "bg-white border-neutral-200 text-neutral-800";
  const muted = isDark ? "text-neutral-400" : "text-neutral-500";
  const strong = isDark ? "text-neutral-100" : "text-neutral-900";
  const inner = isDark ? "bg-neutral-950/60 border-neutral-800" : "bg-neutral-50 border-neutral-200";

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-lg rounded-xl border shadow-xl ${panel}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-5 border-b border-neutral-800/30">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">
                Previsão do Modelo
              </span>
            </div>
            <h3 className={`text-base font-semibold truncate ${strong}`}>
              {s(match.home.name, "?")} <span className={muted}>vs</span> {s(match.away.name, "?")}
            </h3>
            <p className={`text-[11px] mt-0.5 ${muted}`}>ID {match.id}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className={
              "h-8 w-8 flex items-center justify-center rounded-md border transition-colors " +
              (isDark
                ? "border-neutral-800 bg-neutral-900 hover:bg-neutral-800"
                : "border-neutral-200 bg-white hover:bg-neutral-50")
            }
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
          {loading && (
            <div className={`flex items-center gap-2 text-sm ${muted}`}>
              <Loader2 className="h-4 w-4 animate-spin" />
              Consultando o modelo...
            </div>
          )}

          {!loading && result && !result.ok && (
            <div className="rounded-md border border-red-500/30 bg-red-500/10 text-red-500 text-sm p-3 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{typeof result.error === "string" && result.error ? result.error : "Sem previsão disponível."}</span>
            </div>
          )}

          {!loading && result?.ok && (
            <>
              {s(result.prediction?.choice) && (
                <div className={`rounded-md border p-3 ${inner}`}>
                  <div className={`text-[10px] uppercase tracking-wider ${muted} mb-1`}>
                    Escolha do modelo
                  </div>
                  <div className={`text-base font-semibold ${strong}`}>
                    {s(result.prediction?.choice)}
                  </div>
                </div>
              )}

              {result.prediction?.prematch_odds && (
                <div className={`rounded-md border p-3 ${inner}`}>
                  <div className={`text-[10px] uppercase tracking-wider ${muted} mb-2`}>
                    Odds pré-jogo
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className={`text-[10px] uppercase ${muted}`}>Mercado</div>
                      <div className={strong}>{s(result.prediction.prematch_odds.market, "—")}</div>
                    </div>
                    <div>
                      <div className={`text-[10px] uppercase ${muted}`}>Modificador</div>
                      <div className={strong}>{s(result.prediction.prematch_odds.modifier, "—")}</div>
                    </div>
                    <div>
                      <div className={`text-[10px] uppercase ${muted}`}>Seleção</div>
                      <div className={strong}>{s(result.prediction.prematch_odds.selection, "—")}</div>
                    </div>
                    <div>
                      <div className={`text-[10px] uppercase ${muted}`}>Odd</div>
                      <div className="text-emerald-500 font-bold tabular-nums">
                        {s(result.prediction.prematch_odds.odd, "—")}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {s(result.prediction?.reasoning) && (
                <div className={`rounded-md border p-3 ${inner}`}>
                  <div className={`text-[10px] uppercase tracking-wider ${muted} mb-1.5`}>
                    Justificativa
                  </div>
                  <p className={`text-sm leading-relaxed ${isDark ? "text-neutral-300" : "text-neutral-700"}`}>
                    {s(result.prediction?.reasoning)}
                  </p>
                </div>
              )}

              {result.meta && (
                <div className={`rounded-md border p-3 ${inner}`}>
                  <div className={`text-[10px] uppercase tracking-wider ${muted} mb-2`}>
                    Metadados
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className={muted}>Liga: </span>
                      <span className={strong}>{s(result.meta.league?.name, "—")}</span>
                    </div>
                    <div>
                      <span className={muted}>País: </span>
                      <span className={strong}>{s(result.meta.country?.name, "—")}</span>
                    </div>
                    <div>
                      <span className={muted}>Data: </span>
                      <span className={strong}>{s(result.meta.date, "—")}</span>
                    </div>
                    <div>
                      <span className={muted}>Hora: </span>
                      <span className={strong}>{s(result.meta.time, "—")}</span>
                    </div>
                    {s(result.meta.venue?.name) && (
                      <div className="col-span-2">
                        <span className={muted}>Estádio: </span>
                        <span className={strong}>
                          {s(result.meta.venue?.name)}
                          {s(result.meta.venue?.city) ? `, ${s(result.meta.venue?.city)}` : ""}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function LineupsModal({
  match,
  isDark,
  onClose,
}: {
  match: NormalizedMatch;
  isDark: boolean;
  onClose: () => void;
}) {
  const fetchLineups = useServerFn(getMatchLineups);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<LineupsResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setResult(null);
    if (!match.id) {
      setResult({ ok: false, error: "Este jogo não tem ID no feed — sem escalação disponível." });
      setLoading(false);
      return;
    }
    fetchLineups({ data: { matchId: match.id } })
      .then((r) => {
        if (!cancelled) {
          setResult(r);
          setLoading(false);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setResult({ ok: false, error: e instanceof Error ? e.message : "Erro" });
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [fetchLineups, match.id]);

  const panel = isDark
    ? "bg-neutral-900 border-neutral-800 text-neutral-200"
    : "bg-white border-neutral-200 text-neutral-800";
  const muted = isDark ? "text-neutral-400" : "text-neutral-500";
  const strong = isDark ? "text-neutral-100" : "text-neutral-900";
  const inner = isDark ? "bg-neutral-950/60 border-neutral-800" : "bg-neutral-50 border-neutral-200";

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-3xl rounded-xl border shadow-xl ${panel}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-5 border-b border-neutral-800/30">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-3.5 w-3.5 text-sky-500" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-500">
                Escalação
                {s(result?.status) ? ` · ${s(result?.status)}` : ""}
              </span>
            </div>
            <h3 className={`text-base font-semibold truncate ${strong}`}>
              {s(match.home.name, "?")} <span className={muted}>vs</span> {s(match.away.name, "?")}
            </h3>
            <p className={`text-[11px] mt-0.5 ${muted}`}>ID {match.id}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className={
              "h-8 w-8 flex items-center justify-center rounded-md border transition-colors " +
              (isDark
                ? "border-neutral-800 bg-neutral-900 hover:bg-neutral-800"
                : "border-neutral-200 bg-white hover:bg-neutral-50")
            }
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 max-h-[75vh] overflow-y-auto">
          {loading && (
            <div className={`flex items-center gap-2 text-sm ${muted}`}>
              <Loader2 className="h-4 w-4 animate-spin" />
              Buscando escalação...
            </div>
          )}

          {!loading && result && !result.ok && (
            <div className="rounded-md border border-red-500/30 bg-red-500/10 text-red-500 text-sm p-3 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{typeof result.error === "string" && result.error ? result.error : "Sem escalação disponível."}</span>
            </div>
          )}

          {!loading && result?.ok && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TeamLineupBlock team={result.home} muted={muted} strong={strong} inner={inner} />
              <TeamLineupBlock team={result.away} muted={muted} strong={strong} inner={inner} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TeamLineupBlock({
  team,
  muted,
  strong,
  inner,
}: {
  team?: TeamLineup;
  muted: string;
  strong: string;
  inner: string;
}) {
  if (!team) {
    return (
      <div className={`rounded-md border p-3 ${inner} text-sm ${muted}`}>
        Sem dados do time.
      </div>
    );
  }
  return (
    <div className={`rounded-md border p-3 space-y-3 ${inner}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className={`text-sm font-semibold truncate ${strong}`}>
            {s(team.team_name, "—")}
          </div>
          <div className={`text-[11px] ${muted}`}>
            {s(team.team_formation) ? `Formação ${s(team.team_formation)}` : ""}
            {s(team.coach?.name) ? ` · Téc. ${s(team.coach?.name)}` : ""}
          </div>
        </div>
        {typeof team.confidence === "number" && Number.isFinite(team.confidence) && (
          <span
            className={
              "text-[10px] font-bold px-1.5 py-0.5 rounded border border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
            }
          >
            {team.confidence}% conf.
          </span>
        )}
      </div>

      <PlayerGroup title="Titulares" players={team.starting_xi} muted={muted} strong={strong} />
      <PlayerGroup title="Banco" players={team.bench} muted={muted} strong={strong} />
      <SidelinedGroup players={team.sidelined} muted={muted} strong={strong} />
    </div>
  );
}

function PlayerGroup({
  title,
  players,
  muted,
  strong,
}: {
  title: string;
  players?: LineupPlayer[];
  muted: string;
  strong: string;
}) {
  const list = Array.isArray(players) ? players : [];
  if (list.length === 0) return null;
  return (
    <div>
      <div className={`text-[10px] uppercase tracking-wider ${muted} mb-1.5`}>
        {title} ({list.length})
      </div>
      <ul className="space-y-1 text-xs">
        {list.map((p, i) => (
          <li key={p?.id ?? `${title}-${i}`} className="flex items-center gap-2">
            <span
              className={`inline-flex items-center justify-center w-6 h-5 rounded text-[10px] font-bold tabular-nums border ${muted}`}
            >
              {s(p?.number, "—")}
            </span>
            <span className={`flex-1 truncate ${strong}`}>{s(p?.name, "—")}</span>
            <span className={`text-[10px] uppercase ${muted}`}>{s(p?.position, "")}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SidelinedGroup({
  players,
  muted,
  strong,
}: {
  players?: SidelinedPlayer[];
  muted: string;
  strong: string;
}) {
  const list = Array.isArray(players) ? players : [];
  if (list.length === 0) return null;
  return (
    <div>
      <div className={`text-[10px] uppercase tracking-wider ${muted} mb-1.5`}>
        Afastados ({list.length})
      </div>
      <ul className="space-y-1 text-xs">
        {list.map((p, i) => (
          <li key={p?.id ?? `sidelined-${i}`} className="flex items-center gap-2">
            <span
              className={`inline-flex items-center justify-center w-6 h-5 rounded text-[10px] font-bold tabular-nums border ${muted}`}
            >
              {s(p?.number, "—")}
            </span>
            <span className={`flex-1 truncate ${strong}`}>{s(p?.name, "—")}</span>
            <span
              className={
                "text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded border " +
                (p?.status === "out"
                  ? "border-red-500/40 bg-red-500/10 text-red-500"
                  : "border-amber-500/40 bg-amber-500/10 text-amber-500")
              }
            >
              {s(p?.status, "—")}
              {s(p?.reason) ? ` · ${s(p?.reason)}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
