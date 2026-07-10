type SourceTeam = {
  id?: string;
  name?: string;
  goals?: number | null;
  image?: string;
};

type SourceEvent = {
  id?: string;
  type?: string;
  team?: string;
  minute?: string;
  extraMin?: string;
  player?: string;
  assist?: string;
  result?: string;
};

type SourceMatch = {
  id?: string;
  alternateIds?: string[];
  status?: string;
  time?: string;
  date?: string;
  venue?: string;
  home?: SourceTeam;
  away?: SourceTeam;
  finished?: boolean;
  live?: boolean;
  events?: SourceEvent[];
  hasLiveStats?: boolean;
};

type SourceLeague = {
  id?: string;
  name?: string;
  country?: string;
  matches?: SourceMatch[];
};

type SourcePayload = {
  leagues?: SourceLeague[];
};

export type MobileMatchEvent = {
  id: string;
  type: string;
  team: string;
  minute: string | null;
  extraMin: string | null;
  player: string | null;
  assist: string | null;
  result: string | null;
};

export type MobileMatchDTO = {
  id: string;
  alternateIds: string[];
  league: string;
  leagueId: string;
  country: string;
  status: "scheduled" | "live" | "finished";
  rawStatus: string;
  minute: string | null;
  kickoff: string | null;
  startMs: number | null;
  venue: string | null;
  team1: { id: string | null; name: string; logo: string | null };
  team2: { id: string | null; name: string; logo: string | null };
  team1Logo: string | null;
  team2Logo: string | null;
  score1: number | null;
  score2: number | null;
  live: boolean;
  finished: boolean;
  hasLiveStats: boolean;
  events: MobileMatchEvent[];
};

export type MobileNotificationDTO = {
  id: string;
  matchId: string;
  kind: "goal" | "card" | "event" | "live" | "finish";
  type: string;
  title: string;
  text: string;
  league: string;
  leagueId: string;
  minute: string | null;
  team: string | null;
  player: string | null;
  result: string | null;
  score1: number | null;
  score2: number | null;
  status: "scheduled" | "live" | "finished";
  rawStatus: string;
  live: boolean;
  finished: boolean;
  team1: MobileMatchDTO["team1"];
  team2: MobileMatchDTO["team2"];
  fetchedAt: string;
};

function absUrl(origin: string, path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${origin}${path.startsWith("/") ? "" : "/"}${path}`;
}

function teamLogo(team: SourceTeam | undefined, origin: string): string | null {
  if (team?.image) return absUrl(origin, team.image);
  if (team?.id) return absUrl(origin, `/api/public/team-image/${encodeURIComponent(team.id)}`);
  return null;
}

const FINISHED_AFTER_MS = 2.5 * 60 * 60 * 1000; // 2h30 após o kickoff, considera encerrado

function lifecycle(match: SourceMatch, startMs: number | null): "scheduled" | "live" | "finished" {
  if (match.finished) return "finished";
  if (match.live) return "live";
  if (startMs != null) {
    const elapsed = Date.now() - startMs;
    if (elapsed >= FINISHED_AFTER_MS) return "finished";
    if (elapsed >= 0) return "live";
  }
  return "scheduled";
}

function minuteFromStatus(rawStatus: string): string | null {
  const clean = rawStatus.trim();
  const minute = clean.match(/^(\d{1,3})(?:\+(\d{1,2}))?'?$/);
  if (minute) return minute[2] ? `${minute[1]}+${minute[2]}` : minute[1];
  if (/^(HT|INTERVAL)$/i.test(clean)) return "HT";
  return null;
}

function kickoff(date?: string, time?: string): { iso: string | null; ms: number | null } {
  if (!date || !time || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}/.test(time)) {
    return { iso: null, ms: null };
  }
  const parsed = new Date(`${date}T${time.slice(0, 5)}:00-03:00`);
  if (Number.isNaN(parsed.getTime())) return { iso: null, ms: null };
  return { iso: parsed.toISOString(), ms: parsed.getTime() };
}

function normalizeEvent(event: SourceEvent, fallbackId: string): MobileMatchEvent {
  return {
    id: String(event.id || fallbackId),
    type: String(event.type || "event").toLowerCase(),
    team: String(event.team || ""),
    minute: event.minute ? String(event.minute) : null,
    extraMin: event.extraMin ? String(event.extraMin) : null,
    player: event.player ? String(event.player) : null,
    assist: event.assist ? String(event.assist) : null,
    result: event.result ? String(event.result) : null,
  };
}

export function flattenMobileMatches(payload: SourcePayload | undefined, origin: string): MobileMatchDTO[] {
  const out: MobileMatchDTO[] = [];
  for (const league of Array.isArray(payload?.leagues) ? payload.leagues : []) {
    for (const match of Array.isArray(league.matches) ? league.matches : []) {
      const rawStatus = String(match.status || "");
      const k = kickoff(match.date, match.time);
      const status = lifecycle(match, k.ms);
      const team1Logo = teamLogo(match.home, origin);
      const team2Logo = teamLogo(match.away, origin);
      const id = String(match.id || `${match.home?.name || "home"}-${match.away?.name || "away"}`);
      out.push({
        id,
        alternateIds: Array.isArray(match.alternateIds) ? match.alternateIds.map(String) : [],
        league: String(league.name || "Liga"),
        leagueId: String(league.id || ""),
        country: String(league.country || ""),
        status,
        rawStatus,
        minute: status === "live" ? (minuteFromStatus(rawStatus) ?? deriveMinute(k.ms)) : null,
        kickoff: k.iso,
        startMs: k.ms,
        venue: match.venue ? String(match.venue) : null,
        team1: {
          id: match.home?.id ? String(match.home.id) : null,
          name: String(match.home?.name || "?"),
          logo: team1Logo,
        },
        team2: {
          id: match.away?.id ? String(match.away.id) : null,
          name: String(match.away?.name || "?"),
          logo: team2Logo,
        },
        team1Logo,
        team2Logo,
        score1: typeof match.home?.goals === "number" ? match.home.goals : null,
        score2: typeof match.away?.goals === "number" ? match.away.goals : null,
        live: status === "live",
        finished: status === "finished",
        hasLiveStats: Boolean(match.hasLiveStats),
        events: (Array.isArray(match.events) ? match.events : []).map((event, index) =>
          normalizeEvent(event, `${id}-${index}`),
        ),
      });
    }
  }
  return out;
}

function eventKind(type: string): MobileNotificationDTO["kind"] {
  if (type === "goal") return "goal";
  if (type.includes("card") || type.includes("yellow") || type.includes("red")) return "card";
  return "event";
}

function eventTitle(kind: MobileNotificationDTO["kind"], teamName: string): string {
  if (kind === "goal") return `Gol do ${teamName}`;
  if (kind === "card") return "Cartão no jogo";
  if (kind === "finish") return "Jogo encerrado";
  if (kind === "live") return "Jogo ao vivo";
  return "Atualização ao vivo";
}

function eventText(match: MobileMatchDTO, event: MobileMatchEvent): string {
  const minute = event.extraMin
    ? `${event.minute || ""}+${event.extraMin}' `
    : event.minute
      ? `${event.minute}' `
      : "";
  const teamName = event.team === "home" ? match.team1.name : event.team === "away" ? match.team2.name : "";
  const player = event.player ? ` · ${event.player}` : "";
  const result = event.result ? ` (${event.result})` : "";
  return `${minute}${event.type}${teamName ? ` · ${teamName}` : ""}${player}${result}`.trim();
}

export function buildMobileNotifications(
  matches: MobileMatchDTO[],
  fetchedAt: string,
  includeMatchState = true,
): MobileNotificationDTO[] {
  const notifications: MobileNotificationDTO[] = [];
  for (const match of matches) {
    if (includeMatchState && (match.live || match.finished)) {
      const kind: MobileNotificationDTO["kind"] = match.finished ? "finish" : "live";
      notifications.push({
        id: `${match.id}:${kind}`,
        matchId: match.id,
        kind,
        type: kind,
        title: eventTitle(kind, ""),
        text: `${match.team1.name} ${match.score1 ?? 0} x ${match.score2 ?? 0} ${match.team2.name}`,
        league: match.league,
        leagueId: match.leagueId,
        minute: match.minute,
        team: null,
        player: null,
        result: `${match.score1 ?? 0}-${match.score2 ?? 0}`,
        score1: match.score1,
        score2: match.score2,
        status: match.status,
        rawStatus: match.rawStatus,
        live: match.live,
        finished: match.finished,
        team1: match.team1,
        team2: match.team2,
        fetchedAt,
      });
    }

    for (const event of match.events) {
      const kind = eventKind(event.type);
      const teamName = event.team === "home" ? match.team1.name : event.team === "away" ? match.team2.name : "time";
      notifications.push({
        id: `${match.id}:event:${event.id}`,
        matchId: match.id,
        kind,
        type: event.type,
        title: eventTitle(kind, teamName),
        text: eventText(match, event),
        league: match.league,
        leagueId: match.leagueId,
        minute: event.extraMin ? `${event.minute || ""}+${event.extraMin}` : event.minute,
        team: event.team || null,
        player: event.player,
        result: event.result,
        score1: match.score1,
        score2: match.score2,
        status: match.status,
        rawStatus: match.rawStatus,
        live: match.live,
        finished: match.finished,
        team1: match.team1,
        team2: match.team2,
        fetchedAt,
      });
    }
  }
  return notifications;
}