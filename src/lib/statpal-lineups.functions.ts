import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type LineupPlayer = {
  id?: string;
  name?: string;
  number?: string;
  position?: string;
};

export type SidelinedPlayer = LineupPlayer & {
  status?: string;
  reason?: string | null;
};

export type TeamLineup = {
  team_id?: string;
  team_name?: string;
  coach?: { name?: string; id?: string };
  team_formation?: string;
  starting_xi?: LineupPlayer[];
  bench?: LineupPlayer[];
  sidelined?: SidelinedPlayer[];
  confidence?: number;
};

export type LineupsResult = {
  ok: boolean;
  error?: string;
  status?: string;
  updated?: string;
  home?: TeamLineup;
  away?: TeamLineup;
};

// ---- Defensive normalizers ----
// Statpal can return arrays either as `[...]` or as `{ player: [...] }` (XML-ish
// shape), and single objects as either `{...}` or `[{...}]`. Anything else must
// coalesce to an empty array so `.map()` in the UI never crashes.
function toArray<T = unknown>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[];
  if (v && typeof v === "object") {
    const wrap = v as Record<string, unknown>;
    if (Array.isArray(wrap.player)) return wrap.player as T[];
    if (Array.isArray(wrap.item)) return wrap.item as T[];
    // { "0": {...}, "1": {...} } → values
    const vals = Object.values(wrap);
    if (vals.length && vals.every((x) => typeof x === "object")) return vals as T[];
  }
  return [];
}

function pickOne<T = Record<string, unknown>>(v: unknown): T | undefined {
  if (!v) return undefined;
  if (Array.isArray(v)) return (v[0] as T) ?? undefined;
  if (typeof v === "object") return v as T;
  return undefined;
}

function normalizePlayer(p: unknown): LineupPlayer {
  const o = (p && typeof p === "object" ? (p as Record<string, unknown>) : {}) as Record<string, unknown>;
  const str = (x: unknown) => (x == null ? undefined : String(x));
  return {
    id: str(o.id),
    name: str(o.name ?? o.player_name),
    number: str(o.number ?? o.shirt_number ?? o.jersey),
    position: str(o.position ?? o.pos),
  };
}

function normalizeSidelined(p: unknown): SidelinedPlayer {
  const base = normalizePlayer(p);
  const o = (p && typeof p === "object" ? (p as Record<string, unknown>) : {}) as Record<string, unknown>;
  return {
    ...base,
    status: o.status == null ? undefined : String(o.status),
    reason: o.reason == null ? null : String(o.reason),
  };
}

function normalizeTeam(raw: unknown): TeamLineup | undefined {
  const t = pickOne<Record<string, unknown>>(raw);
  if (!t) return undefined;
  const coachRaw = pickOne<Record<string, unknown>>(t.coach);
  const confidenceRaw = t.confidence;
  const confidence =
    typeof confidenceRaw === "number"
      ? confidenceRaw
      : typeof confidenceRaw === "string" && confidenceRaw !== ""
        ? Number(confidenceRaw)
        : undefined;
  return {
    team_id: t.team_id == null ? undefined : String(t.team_id),
    team_name: t.team_name == null ? undefined : String(t.team_name),
    coach: coachRaw
      ? {
          name: coachRaw.name == null ? undefined : String(coachRaw.name),
          id: coachRaw.id == null ? undefined : String(coachRaw.id),
        }
      : undefined,
    team_formation: t.team_formation == null ? undefined : String(t.team_formation),
    starting_xi: toArray(t.starting_xi).map(normalizePlayer),
    bench: toArray(t.bench).map(normalizePlayer),
    sidelined: toArray(t.sidelined).map(normalizeSidelined),
    confidence: Number.isFinite(confidence) ? (confidence as number) : undefined,
  };
}

export const getMatchLineups = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ matchId: z.string().min(1) }).parse(input))
  .handler(async ({ data }): Promise<LineupsResult> => {
    const key = process.env.STATPAL_API_KEY;
    if (!key) return { ok: false, error: "STATPAL_API_KEY não configurada" };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    try {
      const url = `https://statpal.io/api/v2/soccer/team-lineups?access_key=${encodeURIComponent(
        key,
      )}&match_id=${encodeURIComponent(data.matchId)}`;
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
      const raw = (await res.json()) as unknown;
      if (!raw || typeof raw !== "object") {
        return { ok: false, error: "Resposta inválida" };
      }
      const json = raw as Record<string, unknown>;
      if (json.error) {
        const msg =
          typeof json.error === "string"
            ? json.error
            : (json.error as { message?: string })?.message ?? "Sem escalação disponível";
        return { ok: false, error: msg };
      }
      // Some responses nest lineups under `lineups`, `data`, or `match`.
      const container =
        (json.lineups as Record<string, unknown>) ||
        (json.data as Record<string, unknown>) ||
        (json.match as Record<string, unknown>) ||
        json;

      const home = normalizeTeam(container.home);
      const away = normalizeTeam(container.away);

      if (!home && !away) {
        return { ok: false, error: "Escalação não disponível para essa partida" };
      }
      return {
        ok: true,
        status: typeof json.status === "string" ? json.status : undefined,
        updated: typeof json.updated === "string" ? json.updated : undefined,
        home,
        away,
      };
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        return { ok: false, error: "Tempo esgotado ao consultar escalação" };
      }
      return { ok: false, error: e instanceof Error ? e.message : "Erro ao consultar escalação" };
    } finally {
      clearTimeout(timer);
    }
  });
