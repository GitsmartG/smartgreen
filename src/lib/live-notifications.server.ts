import { createClient } from "@supabase/supabase-js";
import { fetchLiveMatchesPayload } from "./daily-matches.server";
import { buildMobileNotifications, flattenMobileMatches, type MobileNotificationDTO } from "./mobile-matches";

type StoredLiveNotification = {
  id: string;
  match_id: string;
  kind: "goal" | "card" | "event" | "live" | "finish";
  type: string;
  title: string;
  text: string;
  league: string;
  league_id: string;
  minute: string | null;
  team: string | null;
  player: string | null;
  result: string | null;
  score1: number | null;
  score2: number | null;
  status: "scheduled" | "live" | "finished";
  raw_status: string;
  live: boolean;
  finished: boolean;
  team1: MobileNotificationDTO["team1"];
  team2: MobileNotificationDTO["team2"];
  fetched_at: string;
  first_seen_at?: string;
  last_seen_at: string;
};

function adminClient() {
  const backendUrl = process.env.SUPABASE_URL;
  const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!backendUrl || !adminKey) throw new Error("Backend não configurado");
  return createClient(backendUrl, adminKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function toRow(n: MobileNotificationDTO, fetchedAt: string) {
  return {
    id: n.id,
    match_id: n.matchId,
    kind: n.kind,
    type: n.type,
    title: n.title,
    text: n.text,
    league: n.league,
    league_id: n.leagueId,
    minute: n.minute,
    team: n.team,
    player: n.player,
    result: n.result,
    score1: n.score1,
    score2: n.score2,
    status: n.status,
    raw_status: n.rawStatus,
    live: n.live,
    finished: n.finished,
    team1: n.team1,
    team2: n.team2,
    fetched_at: fetchedAt,
    last_seen_at: fetchedAt,
  };
}

export function storedNotificationToApi(row: StoredLiveNotification) {
  return {
    id: row.id,
    matchId: row.match_id,
    kind: row.kind,
    type: row.type,
    title: row.title,
    text: row.text,
    league: row.league,
    leagueId: row.league_id,
    minute: row.minute,
    team: row.team,
    player: row.player,
    result: row.result,
    score1: row.score1,
    score2: row.score2,
    status: row.status,
    rawStatus: row.raw_status,
    live: row.live,
    finished: row.finished,
    team1: row.team1,
    team2: row.team2,
    fetchedAt: row.fetched_at,
    firstSeenAt: row.first_seen_at ?? row.last_seen_at,
    lastSeenAt: row.last_seen_at,
  };
}

export async function collectLiveNotifications(origin: string, includeMatchState = true) {
  const fetchedAt = new Date().toISOString();
  const payload = await fetchLiveMatchesPayload();
  const matches = flattenMobileMatches(payload, origin);
  const freshNotifications = buildMobileNotifications(matches, fetchedAt, includeMatchState);

  if (freshNotifications.length > 0) {
    const { error } = await adminClient()
      .from("live_notifications")
      .upsert(freshNotifications.map((n) => toRow(n, fetchedAt)), {
        onConflict: "id",
        ignoreDuplicates: false,
      });
    if (error) throw error;
  }

  return {
    fetchedAt,
    freshNotifications,
    matchesCount: matches.length,
  };
}

export async function readLiveNotifications(limit: number, thresholdIso: string) {
  const { data, error } = await adminClient()
    .from("live_notifications")
    .select("*")
    .gte("last_seen_at", thresholdIso)
    .order("last_seen_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return ((data ?? []) as StoredLiveNotification[]).map(storedNotificationToApi);
}