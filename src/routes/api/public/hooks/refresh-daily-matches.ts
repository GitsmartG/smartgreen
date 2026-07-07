import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/refresh-daily-matches")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Auth simples via apikey (padrão pg_cron)
        const apiKey = request.headers.get("apikey");
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!apiKey || !expected || apiKey !== expected) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
        try {
          const { refreshDailyMatches } = await import("@/lib/daily-matches.server");
          const result = await refreshDailyMatches();
          return Response.json({
            ok: true,
            date: result.date,
            totalMatches: result.payload.totalMatches,
            leagues: result.payload.leagues.length,
          });
        } catch (e) {
          return Response.json(
            { ok: false, error: e instanceof Error ? e.message : "erro" },
            { status: 500 },
          );
        }
      },
    },
  },
});
