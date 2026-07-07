import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getLiveMatches } from "@/lib/daily-matches.functions";

export type LiveNotification = {
  id: string;
  kind: "goal" | "start" | "finish" | "card" | "event";
  home: string;
  away: string;
  score: string;
  league: string;
  scorer?: "home" | "away";
  minute?: string;
  text?: string;
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
  events: Set<string>;
};

const POLL_MS = 15_000;
const MAX_NOTIFS = 25;

export function useLiveGoalNotifications() {
  const fetchLiveMatches = useServerFn(getLiveMatches);
  const [notifs, setNotifs] = useState<LiveNotification[]>([]);
  const snapRef = useRef<Map<string, Snapshot> | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const eventLabel = (event: { type: string; team: string; player?: string; minute: string; extraMin?: string; result?: string }) => {
      const minute = event.extraMin ? `${event.minute}+${event.extraMin}'` : event.minute ? `${event.minute}'` : "";
      const player = event.player ? ` · ${event.player}` : "";
      const result = event.result ? ` ${event.result}` : "";
      const team = event.team === "home" ? "mandante" : event.team === "away" ? "visitante" : event.team;
      if (event.type === "goal") return `${minute} Gol do ${team}${player}${result}`.trim();
      if (event.type.includes("red")) return `${minute} Cartão vermelho (${team})${player}`.trim();
      if (event.type.includes("yellow")) return `${minute} Cartão amarelo (${team})${player}`.trim();
      return `${minute} ${event.type || "Evento"} (${team})${player}${result}`.trim();
    };

    const tick = async () => {
      try {
        const res = await fetchLiveMatches();
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
              events: new Set((m.events ?? []).map((event) => event.id)),
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
                for (const event of m.events ?? []) {
                  if (p.events.has(event.id)) continue;
                  events.push({
                    id: `${m.id}-event-${event.id}-${Date.now()}`,
                    kind: event.type === "goal" ? "goal" : event.type.includes("card") ? "card" : "event",
                    scorer: event.team === "home" || event.team === "away" ? event.team : undefined,
                    minute: event.extraMin ? `${event.minute}+${event.extraMin}'` : event.minute ? `${event.minute}'` : undefined,
                    text: eventLabel(event),
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
  }, [fetchLiveMatches]);

  const dismiss = (id: string) =>
    setNotifs((cur) => cur.filter((n) => n.id !== id));
  const clear = () => setNotifs([]);

  return { notifs, dismiss, clear };
}
