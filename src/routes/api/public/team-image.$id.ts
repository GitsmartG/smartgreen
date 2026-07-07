import { createFileRoute } from "@tanstack/react-router";

function fallbackTeamImage(id: string) {
  const label = String(id || "?").slice(-2).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96" role="img" aria-label="Time sem logo">
  <rect width="96" height="96" rx="48" fill="#111827"/>
  <path d="M48 12 76 23v22c0 18-11.8 31.7-28 39-16.2-7.3-28-21-28-39V23l28-11Z" fill="#1f2937" stroke="#34d399" stroke-width="4"/>
  <text x="48" y="56" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" font-weight="700" fill="#e5e7eb">${label}</text>
</svg>`;

  return new Response(svg, {
    status: 200,
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=3600, s-maxage=86400",
    },
  });
}

// Proxy para imagens da Statpal (grátis, não conta cota — mas tem rate limit).
// A API responde com um redirect (302) pra CDN válido por 5min. Repassamos.
export const Route = createFileRoute("/api/public/team-image/$id")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204 }),
      GET: async ({ params, request }) => {
        const key = process.env.STATPAL_API_KEY;
        if (!key) return fallbackTeamImage(params.id);
        const url = new URL(request.url);
        const type = url.searchParams.get("type") || "team";
        const target = `https://statpal.io/api/v2/soccer/images?type=${encodeURIComponent(type)}&id=${encodeURIComponent(params.id)}&access_key=${key}`;
        try {
          const res = await fetch(target, {
            headers: { Accept: "image/png, image/jpeg, image/webp, application/json" },
            redirect: "follow",
          });
          const ct = res.headers.get("content-type") || "";
          if (!res.ok || !res.body || ct.includes("application/json") || ct.includes("text/")) {
            return fallbackTeamImage(params.id);
          }
          return new Response(res.body, {
            status: 200,
            headers: {
              "content-type": ct,
              // cache agressivo — imagens de time não mudam
              "cache-control": "public, max-age=86400, s-maxage=604800, immutable",
            },
          });
        } catch {
          return fallbackTeamImage(params.id);
        }
      },
    },
  },
});
