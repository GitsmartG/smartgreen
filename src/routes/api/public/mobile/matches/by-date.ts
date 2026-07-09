import { createFileRoute } from "@tanstack/react-router";
import { buildCors, requireApiKey } from "@/lib/api-auth";

const BR_TZ = "America/Sao_Paulo";

function brTodayISO(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: BR_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date());
}

function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function resolveDate(raw: string | null): { date: string; offset: number } | { error: string } {
  const today = brTodayISO();
  const alias = (raw ?? "today").toLowerCase().trim();
  let target = today;
  if (alias === "today" || alias === "hoje" || alias === "") target = today;
  else if (alias === "yesterday" || alias === "ontem") target = addDaysISO(today, -1);
  else if (alias === "tomorrow" || alias === "amanha" || alias === "amanhã") target = addDaysISO(today, 1);
  else if (/^\d{4}-\d{2}-\d{2}$/.test(alias)) target = alias;
  else return { error: "Data inválida. Use YYYY-MM-DD, today, yesterday ou tomorrow." };

  // range ±7 dias
  const [ty, tm, td] = today.split("-").map(Number);
  const [gy, gm, gd] = target.split("-").map(Number);
  const diffDays = Math.round(
    (Date.UTC(gy, gm - 1, gd) - Date.UTC(ty, tm - 1, td)) / (1000 * 60 * 60 * 24),
  );
  if (Math.abs(diffDays) > 7) return { error: "Data fora do range permitido (±7 dias)." };
  return { date: target, offset: diffDays };
}

export const Route = createFileRoute("/api/public/mobile/matches/by-date")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) =>
        new Response(null, { status: 204, headers: buildCors(request) }),
      GET: async ({ request }) => {
        const cors = buildCors(request);
        const unauth = await requireApiKey(request);
        if (unauth) return unauth;
        try {
          const url = new URL(request.url);
          const resolved = resolveDate(url.searchParams.get("date"));
          if ("error" in resolved) {
            return new Response(
              JSON.stringify({ ok: false, error: resolved.error }),
              { status: 400, headers: { "Content-Type": "application/json", ...cors } },
            );
          }
          const { date, offset } = resolved;
          const isToday = offset === 0;

          const { readCachedDaily, refreshDailyMatches } = await import(
            "@/lib/daily-matches.server"
          );

          // Datas passadas: cache é permanente. Hoje/futuro: TTL de 60s.
          const cached = await readCachedDaily(date);
          const CACHE_TTL_MS = 60_000;
          const fresh =
            cached &&
            (offset < 0 || Date.now() - new Date(cached.fetchedAt).getTime() < CACHE_TTL_MS);

          const result =
            fresh && cached
              ? {
                  date: cached.date,
                  fetchedAt: cached.fetchedAt,
                  payload: cached.payload,
                  cached: true,
                }
              : await (async () => {
                  try {
                    const r = await refreshDailyMatches(date);
                    return {
                      date: r.date,
                      fetchedAt: new Date().toISOString(),
                      payload: r.payload,
                      cached: false,
                    };
                  } catch (err) {
                    if (cached)
                      return {
                        date: cached.date,
                        fetchedAt: cached.fetchedAt,
                        payload: cached.payload,
                        cached: true,
                      };
                    throw err;
                  }
                })();

          const { flattenMobileMatches } = await import("@/lib/mobile-matches");
          const origin = url.origin;
          const matches = flattenMobileMatches(result.payload, origin);

          return new Response(
            JSON.stringify({
              ok: true,
              count: matches.length,
              date: result.date,
              offset,
              isToday,
              matches,
              fetchedAt: result.fetchedAt,
              cached: result.cached,
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                "Cache-Control": isToday ? "public, max-age=30" : "public, max-age=300",
                ...cors,
              },
            },
          );
        } catch (e) {
          return new Response(
            JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "erro" }),
            { status: 500, headers: { "Content-Type": "application/json", ...cors } },
          );
        }
      },
    },
  },
});
