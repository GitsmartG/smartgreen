import { createFileRoute } from "@tanstack/react-router";

// Proxy para imagens da Statpal (grátis, não conta cota — mas tem rate limit).
// A API responde com um redirect (302) pra CDN válido por 5min. Repassamos.
export const Route = createFileRoute("/api/public/team-image/$id")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const key = process.env.STATPAL_API_KEY;
        if (!key) return new Response("no api key", { status: 500 });
        const url = new URL(request.url);
        const type = url.searchParams.get("type") || "team";
        const target = `https://statpal.io/api/v2/soccer/images?type=${encodeURIComponent(type)}&id=${encodeURIComponent(params.id)}&access_key=${key}`;
        try {
          const res = await fetch(target, {
            headers: { Accept: "image/png, image/jpeg, image/webp, application/json" },
            redirect: "follow",
          });
          if (!res.ok || !res.body) {
            return new Response("upstream error", { status: 502 });
          }
          const ct = res.headers.get("content-type") || "image/png";
          return new Response(res.body, {
            status: 200,
            headers: {
              "content-type": ct,
              // cache agressivo — imagens de time não mudam
              "cache-control": "public, max-age=86400, s-maxage=604800, immutable",
            },
          });
        } catch {
          return new Response("fetch failed", { status: 502 });
        }
      },
    },
  },
});
