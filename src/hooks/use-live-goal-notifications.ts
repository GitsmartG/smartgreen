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

    const isTodayMatch = (m: { date?: string }, todayIso: string): boolean => {
      const raw = m.date;
      if (!raw) return false;
      // Statpal costuma retornar "DD.MM.YYYY". Aceita "YYYY-MM-DD" também.
      let iso: string | null = null;
      const dm = /^(\d{2})\.(\d{2})\.(\d{4})/.exec(raw);
      if (dm) iso = `${dm[3]}-${dm[2]}-${dm[1]}`;
      else if (/^\d{4}-\d{2}-\d{2}/.test(raw)) iso = raw.slice(0, 10);
      return iso === todayIso;
    };

    const tick = async () => {
      try {
        const res = await getTodayMatches();
        if (cancelled) return;
        const leagues = res?.payload?.leagues ?? [];
        const todayIso = new Date().toISOString().slice(0, 10);
        const apiDate = res?.date; // formato "YYYY-MM-DD" do backend
        const next = new Map<string, Snapshot>();
        const events: LiveNotification[] = [];
        const prev = snapRef.current;

        for (const lg of leagues) {
          for (const m of lg.matches ?? []) {
            // Só rastreia partidas realmente de hoje
            const dateOk =
              isTodayMatch(m, todayIso) || (apiDate && isTodayMatch(m, apiDate));
            if (!dateOk) continue;

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
                // Ignora eventos vindos de jogos que nunca estiveram ao vivo
                // durante nossa observação (evita "encerrado" de jogo antigo).
                const wasOrIsLive = p.live || snap.live;
                if (!wasOrIsLive) continue;

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
                if (!p.finished && snap.finished && p.live) {
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
