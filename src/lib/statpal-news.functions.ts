import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type StorylineItem =
  | { type: "insight"; summary: string }
  | { type: "quote"; quote: string; speaker?: string; context?: string; translated_from?: string };

export type NewsResult = {
  ok: boolean;
  error?: string;
  meta?: {
    updated?: string;
    updated_ts?: number;
    date?: string;
    time?: string;
    home_team?: { id?: string; name?: string };
    away_team?: { id?: string; name?: string };
    league?: { name?: string };
    country?: { name?: string };
    venue?: { name?: string; city?: string };
  };
  storylines?: {
    match_context: StorylineItem[];
    home: StorylineItem[];
    away: StorylineItem[];
    rivalry?: {
      same_city?: boolean;
      is_named_derby?: boolean;
      derby_name?: string | null;
      derby_name_localized?: string | null;
    };
  };
};

// cache 5min por match_id (evita estourar limite Statpal)
const CACHE = new Map<string, { at: number; data: NewsResult }>();
const TTL_MS = 5 * 60 * 1000;

export const getMatchNews = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ matchId: z.string().min(1) }).parse(input))
  .handler(async ({ data }): Promise<NewsResult> => {
    const key = process.env.STATPAL_API_KEY;
    if (!key) return { ok: false, error: "STATPAL_API_KEY não configurada" };

    const cached = CACHE.get(data.matchId);
    if (cached && Date.now() - cached.at < TTL_MS) return cached.data;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    try {
      const url = `https://statpal.io/api/v2/soccer/live-storylines?access_key=${encodeURIComponent(
        key,
      )}&match_id=${encodeURIComponent(data.matchId)}`;
      const res = await fetch(url, { headers: { Accept: "application/json" }, signal: controller.signal });
      if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
      const json = (await res.json()) as {
        meta?: NewsResult["meta"];
        live_storylines?: NewsResult["storylines"];
        error?: unknown;
      };
      if (json?.error) {
        const msg =
          typeof json.error === "string"
            ? json.error
            : (json.error as { message?: string })?.message ?? "Sem storylines disponíveis";
        return { ok: false, error: msg };
      }
      if (!json?.live_storylines) return { ok: false, error: "Sem storylines para essa partida" };
      const out: NewsResult = { ok: true, meta: json.meta, storylines: json.live_storylines };
      CACHE.set(data.matchId, { at: Date.now(), data: out });
      return out;
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return { ok: false, error: "Tempo esgotado" };
      return { ok: false, error: e instanceof Error ? e.message : "Erro ao consultar storylines" };
    } finally {
      clearTimeout(timer);
    }
  });
