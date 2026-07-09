import { createFileRoute } from "@tanstack/react-router";
import { buildCors, requireApiKey } from "@/lib/api-auth";

export const Route = createFileRoute("/api/public/mobile/news/$matchId")({
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

        const key = process.env.STATPAL_API_KEY;
        if (!key) {
          return new Response(
            JSON.stringify({ ok: false, error: "STATPAL_API_KEY não configurada" }),
            { status: 500, headers: { "Content-Type": "application/json", ...cors } },
          );
        }

        try {
          const url = `https://statpal.io/api/v2/soccer/live-storylines?access_key=${encodeURIComponent(
            key,
          )}&match_id=${encodeURIComponent(matchId)}`;
          const res = await fetch(url, { headers: { Accept: "application/json" } });
          if (!res.ok) {
            return new Response(
              JSON.stringify({ ok: false, error: `HTTP ${res.status}` }),
              { status: 502, headers: { "Content-Type": "application/json", ...cors } },
            );
          }
          const json = (await res.json()) as {
            meta?: unknown;
            live_storylines?: unknown;
            error?: unknown;
          };
          if (json?.error) {
            const msg =
              typeof json.error === "string"
                ? json.error
                : (json.error as { message?: string })?.message ?? "Sem storylines";
            return new Response(
              JSON.stringify({ ok: false, error: msg }),
              { status: 404, headers: { "Content-Type": "application/json", ...cors } },
            );
          }
          return new Response(
            JSON.stringify({ ok: true, meta: json.meta, storylines: json.live_storylines }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                "Cache-Control": "public, max-age=300",
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
