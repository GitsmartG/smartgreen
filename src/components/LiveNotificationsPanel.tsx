import { useEffect, useRef, useState } from "react";
import { Bell, Trophy, Play, Flag, X, AlertTriangle, Activity, Radio } from "lucide-react";
import { useLiveGoalNotifications, type LiveNotification } from "@/hooks/use-live-goal-notifications";

function timeAgo(ts: number): string {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  return `${h}h`;
}

function iconFor(kind: LiveNotification["kind"]) {
  if (kind === "goal") return <Trophy className="h-3.5 w-3.5 text-emerald-400" />;
  if (kind === "start") return <Play className="h-3.5 w-3.5 text-sky-400" />;
  if (kind === "card") return <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />;
  if (kind === "event") return <Activity className="h-3.5 w-3.5 text-sky-400" />;
  return <Flag className="h-3.5 w-3.5 text-neutral-400" />;
}

function accentFor(kind: LiveNotification["kind"]): string {
  if (kind === "goal") return "before:bg-emerald-500";
  if (kind === "start") return "before:bg-sky-500";
  if (kind === "card") return "before:bg-amber-500";
  if (kind === "event") return "before:bg-sky-500";
  return "before:bg-neutral-500";
}

function titleFor(n: LiveNotification): string {
  if (n.kind === "goal") {
    const who = n.scorer === "home" ? n.home : n.away;
    return `⚽ Gol do ${who || "time"}`;
  }
  if (n.kind === "start") return "🔔 Jogo começou";
  if (n.kind === "card") return "🟨 Cartão no jogo";
  if (n.kind === "event") return "📡 Atualização ao vivo";
  return "🏁 Jogo encerrado";
}

export function LiveNotificationsPanel({ isDark }: { isDark: boolean }) {
  const hook = useLiveGoalNotifications() ?? { notifs: [], dismiss: () => {}, clear: () => {} };
  const { notifs: raw, dismiss, clear } = hook;
  const notifs = (Array.isArray(raw) ? raw : [])
    .filter((n): n is LiveNotification => !!n && typeof n === "object" && typeof n.id === "string")
    .slice(0, 3);

  const border = isDark ? "border-neutral-800" : "border-neutral-200";
  const item = isDark
    ? "bg-neutral-950/70 border-neutral-800 text-neutral-200 hover:border-neutral-700"
    : "bg-white border-neutral-200 text-neutral-800 hover:border-neutral-300";
  const muted = isDark ? "text-neutral-500" : "text-neutral-500";
  const trackBg = isDark ? "bg-neutral-800/70" : "bg-neutral-200";

  // Barra de progresso custom baseada no scroll do painel
  const scrollRef = useRef<HTMLUListElement | null>(null);
  const [scrollPct, setScrollPct] = useState(0);
  const [thumbHeight, setThumbHeight] = useState(20);
  const [needsScroll, setNeedsScroll] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => {
      const max = el.scrollHeight - el.clientHeight;
      const has = max > 4;
      setNeedsScroll(has);
      if (!has) {
        setScrollPct(0);
        setThumbHeight(100);
        return;
      }
      setScrollPct((el.scrollTop / max) * 100);
      setThumbHeight(Math.max(16, (el.clientHeight / el.scrollHeight) * 100));
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [notifs.length]);

  return (
    <div className={`border-t ${border} p-3`}>
      {/* Header */}
      <div className="flex items-center justify-between px-1 pb-2.5">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em]">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-70 animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <Bell className="h-3.5 w-3.5 text-emerald-500" />
          <span>Ao vivo</span>
          {notifs.length > 0 && (
            <span className="ml-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 text-[10px] font-bold tabular-nums">
              {notifs.length}
            </span>
          )}
        </div>
        {notifs.length > 0 && (
          <button
            onClick={clear}
            className={`text-[10px] font-medium uppercase tracking-wider ${muted} hover:text-emerald-500 transition-colors`}
          >
            limpar
          </button>
        )}
      </div>

      {notifs.length === 0 ? (
        <div
          className={
            "rounded-lg border border-dashed px-3 py-4 text-center " +
            (isDark ? "border-neutral-800" : "border-neutral-300")
          }
        >
          <Radio className={`h-4 w-4 mx-auto mb-1.5 ${muted}`} />
          <p className={`text-[11px] ${muted}`}>Sem eventos agora.</p>
          <p className={`text-[10px] ${muted} opacity-70`}>Acompanhando em tempo real…</p>
        </div>
      ) : (
        <div className="relative flex gap-2">
          <ul
            ref={scrollRef}
            className="flex-1 min-w-0 space-y-1.5 max-h-[440px] overflow-y-auto pr-1 scrollbar-none"
            style={{ scrollbarWidth: "none" }}
          >
            {notifs.map((n) => (
              <li
                key={n.id}
                className={
                  `group relative rounded-lg border px-2.5 py-2 pl-3 text-[11px] transition-all overflow-hidden ` +
                  `before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] ${accentFor(n.kind)} ` +
                  item
                }
              >
                <button
                  onClick={() => dismiss(n.id)}
                  className={`absolute top-1 right-1 opacity-0 group-hover:opacity-100 ${muted} hover:text-emerald-500 transition-opacity`}
                  aria-label="Dispensar"
                >
                  <X className="h-3 w-3" />
                </button>
                <div className="flex items-center gap-1.5 font-semibold">
                  {iconFor(n.kind)}
                  <span className="truncate">{titleFor(n)}</span>
                </div>
                <div className="mt-0.5 truncate">
                  <span className="opacity-90">{n.home ?? "?"}</span>{" "}
                  <span className="text-emerald-500 font-bold tabular-nums">{n.score ?? ""}</span>{" "}
                  <span className="opacity-90">{n.away ?? "?"}</span>
                </div>
                {n.text && (
                  <div className="mt-0.5 truncate text-emerald-500/90 text-[10.5px]">
                    {n.text}
                  </div>
                )}
                <div className={`mt-1 flex items-center justify-between ${muted}`}>
                  <span className="truncate text-[10px]">{n.league ?? ""}</span>
                  <span className="shrink-0 ml-2 inline-flex items-center gap-1 text-[10px] tabular-nums">
                    <span className="h-1 w-1 rounded-full bg-emerald-500/70" />
                    há {timeAgo(n.at)}
                  </span>
                </div>
              </li>
            ))}
          </ul>

          {/* Nossa barra de progresso custom (substitui o scrollbar padrão) */}
          {needsScroll && (
            <div className={`relative w-1 rounded-full ${trackBg} shrink-0`}>
              <div
                className="absolute left-0 right-0 rounded-full bg-gradient-to-b from-emerald-400 to-emerald-600 shadow-[0_0_8px_rgba(16,185,129,0.5)] transition-[top] duration-75"
                style={{
                  height: `${thumbHeight}%`,
                  top: `${scrollPct * (1 - thumbHeight / 100)}%`,
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
