import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Newspaper, RefreshCw, Quote, Lightbulb, Search, Loader2, AlertCircle } from "lucide-react";
import { useIsDark } from "@/hooks/use-is-dark";
import { getMatchesByDate } from "@/lib/daily-matches.functions";
import { getMatchNews, type NewsResult } from "@/lib/statpal-news.functions";
import type { NormalizedMatch } from "@/lib/daily-matches.server";

export const Route = createFileRoute("/dashboard/news")({
  component: NewsPage,
});

function NewsPage() {
  const isDark = useIsDark();
  const fetchMatches = useServerFn(getMatchesByDate);
  const fetchNews = useServerFn(getMatchNews);

  const panel = isDark ? "bg-neutral-900 border-neutral-800" : "bg-white border-neutral-200";
  const muted = isDark ? "text-neutral-400" : "text-neutral-500";
  const item = isDark
    ? "bg-neutral-950 border-neutral-800 hover:border-neutral-700"
    : "bg-white border-neutral-200 hover:border-neutral-300";

  type ItemMatch = NormalizedMatch & { leagueName?: string };
  const [matches, setMatches] = useState<ItemMatch[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ItemMatch | null>(null);
  const [news, setNews] = useState<NewsResult | null>(null);
  const [loadingNews, setLoadingNews] = useState(false);

  const loadMatches = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetchMatches({ data: { date: "today" } });
      const list: ItemMatch[] = (res?.payload?.leagues ?? []).flatMap((lg) =>
        (lg.matches ?? []).map((m) => ({ ...m, leagueName: lg.name })),
      );
      setMatches(list);
    } catch {
      setMatches([]);
    } finally {
      setLoadingList(false);
    }
  }, [fetchMatches]);

  useEffect(() => {
    void loadMatches();
  }, [loadMatches]);

  const loadNews = useCallback(
    async (m: ItemMatch) => {
      setSelected(m);
      setNews(null);
      const id = (m.id ?? "").toString().trim();
      if (!id) {
        setNews({ ok: false, error: "Este jogo não tem ID válido para buscar storylines." });
        return;
      }
      setLoadingNews(true);
      try {
        const r = await fetchNews({ data: { matchId: id } });
        setNews(r);
      } catch (e) {
        setNews({ ok: false, error: e instanceof Error ? e.message : "Erro" });
      } finally {
        setLoadingNews(false);
      }
    },
    [fetchNews],
  );


  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return matches;
    return matches.filter((m) => {
      const hay = `${m.home?.name ?? ""} ${m.away?.name ?? ""} ${m.leagueName ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [matches, query]);

  return (
    <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
      {/* Lista de jogos */}
      <div className={`rounded-xl border ${panel} p-3 flex flex-col min-h-[70vh]`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Newspaper className="h-4 w-4 text-emerald-500" />
            <span className="text-sm font-semibold">Jogos de hoje</span>
          </div>
          <button
            onClick={() => void loadMatches()}
            className={`h-8 w-8 rounded-md border flex items-center justify-center ${isDark ? "border-neutral-800 hover:bg-neutral-800" : "border-neutral-300 hover:bg-neutral-50"}`}
            aria-label="Atualizar"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingList ? "animate-spin" : ""}`} />
          </button>
        </div>
        <div className="relative mb-2">
          <Search className={`absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 ${muted}`} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar time ou liga"
            className={
              "h-9 w-full rounded-md border pl-8 pr-3 text-sm outline-none " +
              (isDark
                ? "bg-neutral-950 border-neutral-800 text-neutral-100 placeholder:text-neutral-600"
                : "bg-white border-neutral-300 text-neutral-900 placeholder:text-neutral-400")
            }
          />
        </div>
        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
          {loadingList && matches.length === 0 ? (
            <div className={`text-xs ${muted} py-6 text-center`}>Carregando…</div>
          ) : filtered.length === 0 ? (
            <div className={`text-xs ${muted} py-6 text-center`}>Nenhum jogo encontrado.</div>
          ) : (
            filtered.map((m) => {
              const active = selected?.id === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => void loadNews(m)}
                  className={
                    "w-full text-left rounded-md border px-3 py-2 text-xs transition-colors " +
                    (active
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-500"
                      : item)
                  }
                >
                  <div className="font-medium truncate">
                    {m.home?.name ?? "?"} <span className={muted}>vs</span> {m.away?.name ?? "?"}
                  </div>
                  <div className={`mt-0.5 truncate ${muted}`}>{m.leagueName ?? ""}</div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Painel storylines */}
      <div className={`rounded-xl border ${panel} p-5 min-h-[70vh]`}>
        {!selected ? (
          <div className={`h-full flex flex-col items-center justify-center ${muted} text-center gap-2`}>
            <Newspaper className="h-8 w-8 opacity-60" />
            <p className="text-sm">Selecione um jogo para ver as storylines editoriais.</p>
            <p className="text-xs opacity-70">Insights, quotes e informações de rivalidade.</p>
          </div>
        ) : loadingNews ? (
          <div className={`h-full flex items-center justify-center ${muted}`}>
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Buscando storylines…
          </div>
        ) : !news?.ok ? (
          <div className="flex items-start gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-500">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <div>
              <div className="font-semibold">Sem storylines</div>
              <div className="opacity-90">{news?.error ?? "Sem conteúdo disponível para essa partida."}</div>
            </div>
          </div>
        ) : (
          <StorylinesView news={news} isDark={isDark} match={selected} />
        )}
      </div>
    </div>
  );
}

function StorylinesView({
  news,
  isDark,
  match,
}: {
  news: NewsResult;
  isDark: boolean;
  match: NormalizedMatch;
}) {
  const muted = isDark ? "text-neutral-400" : "text-neutral-500";
  const homeName = news.meta?.home_team?.name ?? match.home?.name ?? "Casa";
  const awayName = news.meta?.away_team?.name ?? match.away?.name ?? "Fora";

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">
          {homeName} <span className={muted}>vs</span> {awayName}
        </h3>
        <p className={`text-xs ${muted} mt-0.5`}>
          {[news.meta?.league?.name, news.meta?.venue?.name, news.meta?.date].filter(Boolean).join(" · ")}
        </p>
      </div>

      <StorylineSection title="Contexto da partida" items={news.storylines?.match_context ?? []} isDark={isDark} />
      <StorylineSection title={homeName} items={news.storylines?.home ?? []} isDark={isDark} />
      <StorylineSection title={awayName} items={news.storylines?.away ?? []} isDark={isDark} />

      {news.storylines?.rivalry && (news.storylines.rivalry.is_named_derby || news.storylines.rivalry.same_city) && (
        <div className={`rounded-md border p-3 text-xs ${isDark ? "border-neutral-800 bg-neutral-950" : "border-neutral-200 bg-neutral-50"}`}>
          <span className="font-semibold">Rivalidade: </span>
          {news.storylines.rivalry.derby_name_localized ??
            news.storylines.rivalry.derby_name ??
            (news.storylines.rivalry.same_city ? "Clássico da mesma cidade" : "—")}
        </div>
      )}
    </div>
  );
}

function StorylineSection({
  title,
  items,
  isDark,
}: {
  title: string;
  items: NonNullable<NewsResult["storylines"]>["match_context"];
  isDark: boolean;
}) {
  if (!items || items.length === 0) return null;
  const muted = isDark ? "text-neutral-400" : "text-neutral-500";
  const card = isDark ? "border-neutral-800 bg-neutral-950" : "border-neutral-200 bg-neutral-50";

  return (
    <section>
      <h4 className="text-[11px] font-semibold uppercase tracking-[0.12em] mb-2 opacity-80">{title}</h4>
      <ul className="space-y-2">
        {items.map((it, idx) => (
          <li key={idx} className={`rounded-md border p-3 text-sm ${card}`}>
            {it.type === "insight" ? (
              <div className="flex gap-2">
                <Lightbulb className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" />
                <p className="leading-relaxed">{it.summary}</p>
              </div>
            ) : (
              <div className="flex gap-2">
                <Quote className="h-4 w-4 shrink-0 text-sky-500 mt-0.5" />
                <div>
                  <p className="leading-relaxed italic">"{it.quote}"</p>
                  {(it.speaker || it.context) && (
                    <p className={`text-[11px] mt-1 ${muted}`}>
                      {it.speaker ?? ""}
                      {it.speaker && it.context ? " · " : ""}
                      {it.context ?? ""}
                    </p>
                  )}
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
