import { createFileRoute } from "@tanstack/react-router";
import { buildCors, requireApiKey } from "@/lib/api-auth";

export const Route = createFileRoute("/api/public/mobile/matches/live")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) =>
        new Response(null, { status: 204, headers: buildCors(request) }),
      GET: async ({ request }) => {
        const cors = buildCors(request);
        const unauth = await requireApiKey(request);
        if (unauth) return unauth;
        try {
          const { fetchLiveMatchesPayload } = await import("@/lib/daily-matches.server");
          const { flattenMobileMatches } = await import("@/lib/mobile-matches");
          const payload = await fetchLiveMatchesPayload();
          const origin = new URL(request.url).origin;
          const matches = flattenMobileMatches(payload, origin);
          return new Response(
            JSON.stringify({
              ok: true,
              fetchedAt: new Date().toISOString(),
              count: matches.length,
              matches,
              ...payload,
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                "Cache-Control": "no-store, max-age=0",
                Pragma: "no-cache",
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
