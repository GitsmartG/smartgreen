import { createFileRoute } from "@tanstack/react-router";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const Route = createFileRoute("/api/public/mobile/matches/live")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async () => {
        try {
          const { fetchLiveMatchesPayload } = await import("@/lib/daily-matches.server");
          const payload = await fetchLiveMatchesPayload();
          return new Response(
            JSON.stringify({ ok: true, fetchedAt: new Date().toISOString(), ...payload }),
            { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=10", ...CORS } },
          );
        } catch (e) {
          return new Response(
            JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "erro" }),
            { status: 500, headers: { "Content-Type": "application/json", ...CORS } },
          );
        }
      },
    },
  },
});
