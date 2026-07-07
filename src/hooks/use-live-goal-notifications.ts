import { useEffect, useRef, useState } from "react";
import { getTodayMatches } from "@/lib/daily-matches.functions";

export type LiveNotification = {
  id: string;
  kind: "goal" | "start" | "finish";
  home: string;
  away: string;
  score: string;
  league: string;
  scorer?: "home" | "away";
  at: number;
};

type Snapshot = {
  home: number | null;
  away: number | null;
  live: boolean;
  finished: boolean;
  homeName: string;
  awayName: string;
  league: string;
};

const POLL_MS = 25_000;
const MAX_NOTIFS = 25;

export function useLiveGoalNotifications() {
  const [notifs, setNotifs] = useState<LiveNotification[]>([]);
  const snapRef = useRef<Map<string, Snapshot> | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      try {
        const res = await getTodayMatches();
        if (cancelled) return;
        const leagues = res?.payload?.leagues ?? [];
        const next = new Map<string, Snapshot>();
        const events: LiveNotification[] = [];
        const prev = snapRef.current;

        for (const lg of leagues) {
          for (const m of lg.matches ?? []) {
            const snap: Snapshot = {
              home: m.home?.goals ?? null,
              away: m.away?.goals ?? null,
              live: !!m.live,
              finished: !!m.finished,
              homeName: m.home?.name ?? "",
              awayName: m.away?.name ?? "",
              league: lg.name ?? "",
            };
            next.set(m.id, snap);

            if (prev) {
              const p = prev.get(m.id);
              if (p) {
                const scoreStr = `${snap.home ?? 0} x ${snap.away ?? 0}`;
                const base = {
                  home: snap.homeName,
                  away: snap.awayName,
                  score: scoreStr,
                  league: snap.league,
                  at: Date.now(),
                };
                if ((snap.home ?? 0) > (p.home ?? 0)) {
                  events.push({
                    id: `${m.id}-h-${snap.home}-${Date.now()}`,
                    kind: "goal",
                    scorer: "home",
                    ...base,
                  });
                }
                if ((snap.away ?? 0) > (p.away ?? 0)) {
                  events.push({
                    id: `${m.id}-a-${snap.away}-${Date.now()}`,
                    kind: "goal",
                    scorer: "away",
                    ...base,
                  });
                }
                if (!p.live && snap.live && !snap.finished) {
                  events.push({
                    id: `${m.id}-start-${Date.now()}`,
                    kind: "start",
                    ...base,
                  });
                }
                if (!p.finished && snap.finished) {
                  events.push({
                    id: `${m.id}-end-${Date.now()}`,
                    kind: "finish",
                    ...base,
                  });
                }
              }
            }
          }
        }

        snapRef.current = next;
        if (events.length > 0) {
          setNotifs((cur) => [...events.reverse(), ...cur].slice(0, MAX_NOTIFS));
        }
      } catch {
        // silencioso
      } finally {
        if (!cancelled) timer = setTimeout(tick, POLL_MS);
      }
    };

    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  const dismiss = (id: string) =>
    setNotifs((cur) => cur.filter((n) => n.id !== id));
  const clear = () => setNotifs([]);

  return { notifs, dismiss, clear };
}
