import { Bell, Trophy, Play, Flag, X, BadgeAlert, Activity } from "lucide-react";
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
  if (kind === "card") return <BadgeAlert className="h-3.5 w-3.5 text-amber-400" />;
  if (kind === "event") return <Activity className="h-3.5 w-3.5 text-sky-400" />;
  return <Flag className="h-3.5 w-3.5 text-neutral-400" />;
}

function titleFor(n: LiveNotification): string {
  if (n.kind === "goal") {
    const who = n.scorer === "home" ? n.home : n.away;
    return `⚽ Gol do ${who}`;
  }
  if (n.kind === "start") return "🔔 Jogo começou";
  if (n.kind === "card") return "🟨 Cartão no jogo";
  if (n.kind === "event") return "📡 Atualização ao vivo";
  return "🏁 Jogo encerrado";
}

export function LiveNotificationsPanel({ isDark }: { isDark: boolean }) {
  const { notifs: raw, dismiss, clear } = useLiveGoalNotifications();
  const notifs = Array.isArray(raw) ? raw : [];


  const border = isDark ? "border-neutral-800" : "border-neutral-200";
  const item = isDark
    ? "bg-neutral-950/60 border-neutral-800 text-neutral-200"
    : "bg-white border-neutral-200 text-neutral-800";
  const muted = isDark ? "text-neutral-500" : "text-neutral-500";

  return (
    <div className={`border-t ${border} p-3`}>
      <div className="flex items-center justify-between px-1 pb-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
          <Bell className="h-3.5 w-3.5 text-emerald-500" />
          <span>Ao vivo</span>
          {notifs.length > 0 && (
            <span className="ml-1 rounded-full bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 text-[10px]">
              {notifs.length}
            </span>
          )}
        </div>
        {notifs.length > 0 && (
          <button
            onClick={clear}
            className={`text-[10px] ${muted} hover:text-emerald-500`}
          >
            limpar
          </button>
        )}
      </div>

      {notifs.length === 0 ? (
        <p className={`px-1 text-[11px] ${muted}`}>
          Sem eventos agora. Acompanhando…
        </p>
      ) : (
        <ul className="space-y-1.5 max-h-[440px] overflow-y-auto pr-1">
          {notifs.map((n) => (
            <li
              key={n.id}
              className={`group relative rounded-md border px-2.5 py-2 text-[11px] ${item}`}
            >
              <button
                onClick={() => dismiss(n.id)}
                className={`absolute top-1 right-1 opacity-0 group-hover:opacity-100 ${muted} hover:text-emerald-500`}
                aria-label="Dispensar"
              >
                <X className="h-3 w-3" />
              </button>
              <div className="flex items-center gap-1.5 font-semibold">
                {iconFor(n.kind)}
                <span className="truncate">{titleFor(n)}</span>
              </div>
              <div className="mt-0.5 truncate">
                {n.home} <span className="text-emerald-500 font-bold">{n.score}</span> {n.away}
              </div>
              {n.text && (
                <div className="mt-0.5 truncate text-emerald-500">
                  {n.text}
                </div>
              )}
              <div className={`mt-0.5 flex items-center justify-between ${muted}`}>
                <span className="truncate">{n.league}</span>
                <span className="shrink-0 ml-2">há {timeAgo(n.at)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
