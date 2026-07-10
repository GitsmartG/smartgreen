import { createFileRoute } from "@tanstack/react-router";
import { buildCors, requireApiKey } from "@/lib/api-auth";

export const Route = createFileRoute("/api/public/mobile/prediction/$matchId")({
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
          const url = `https://statpal.io/api/v2/soccer/predictions?access_key=${encodeURIComponent(
            key,
          )}&match_id=${encodeURIComponent(matchId)}`;
          const res = await fetch(url, { headers: { Accept: "application/json" } });
          const json = (await res.json()) as {
            meta?: unknown;
            prediction?: unknown;
            error?: unknown;
          };
          if (!res.ok || json?.error) {
            const msg =
              typeof json?.error === "string"
                ? json.error
                : (json?.error as { message?: string })?.message ?? `HTTP ${res.status}`;
            return new Response(
              JSON.stringify({ ok: false, error: msg }),
              { status: 404, headers: { "Content-Type": "application/json", ...cors } },
            );
          }
          return new Response(
            JSON.stringify({ ok: true, meta: json.meta, prediction: json.prediction }),
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
