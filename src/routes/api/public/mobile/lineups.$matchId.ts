import { createFileRoute } from "@tanstack/react-router";
import { buildCors, requireApiKey } from "@/lib/api-auth";

export const Route = createFileRoute("/api/public/mobile/lineups/$matchId")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) =>
        new Response(null, { status: 204, headers: buildCors(request) }),
      GET: async ({ request, params }) => {
        const cors = buildCors(request);
        const unauth = await requireApiKey(request);
        if (unauth) return unauth;

        const matchId = String(params.matchId ?? "").trim();
        if (!matchId) {
          return new Response(
            JSON.stringify({ ok: false, error: "matchId obrigatório" }),
            { status: 400, headers: { "Content-Type": "application/json", ...cors } },
          );
        }

        try {
          const { fetchMatchLineups } = await import("@/lib/statpal-lineups.server");
          const result = await fetchMatchLineups(matchId);
          const status = result.ok ? 200 : 404;
          return new Response(JSON.stringify(result), {
            status,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "public, max-age=120",
              ...cors,
            },
          });
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
