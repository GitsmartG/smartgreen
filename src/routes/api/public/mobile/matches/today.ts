import { createFileRoute } from "@tanstack/react-router";
import { buildCors, requireApiKey } from "@/lib/api-auth";

export const Route = createFileRoute("/api/public/mobile/matches/today")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) =>
        new Response(null, { status: 204, headers: buildCors(request) }),
      GET: async ({ request }) => {
        const cors = buildCors(request);
        const unauth = requireApiKey(request);
        if (unauth) return unauth;
        try {
          const { readCachedDaily, refreshDailyMatches } = await import("@/lib/daily-matches.server");
          const cached = await readCachedDaily();
          const CACHE_TTL_MS = 60_000;
          const fresh =
            cached && Date.now() - new Date(cached.fetchedAt).getTime() < CACHE_TTL_MS;
          const result = fresh && cached
            ? { date: cached.date, fetchedAt: cached.fetchedAt, payload: cached.payload, cached: true }
            : await (async () => {
                try {
                  const r = await refreshDailyMatches();
                  return { date: r.date, fetchedAt: new Date().toISOString(), payload: r.payload, cached: false };
                } catch (err) {
                  if (cached) return { date: cached.date, fetchedAt: cached.fetchedAt, payload: cached.payload, cached: true };
                  throw err;
                }
              })();
          return new Response(
            JSON.stringify({ ok: true, ...result }),
            { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=30", ...cors } },
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
