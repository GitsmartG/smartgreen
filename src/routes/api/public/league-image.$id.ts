import { createFileRoute } from "@tanstack/react-router";

function fallbackLeagueImage(id: string) {
  const label = String(id || "?").slice(-2).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96" role="img" aria-label="Liga sem logo">
  <rect width="96" height="96" rx="16" fill="#111827"/>
  <circle cx="48" cy="48" r="28" fill="#1f2937" stroke="#f59e0b" stroke-width="4"/>
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

// Proxy para logo de ligas (Statpal). Mesma lógica do team-image, mas type=league por padrão.
export const Route = createFileRoute("/api/public/league-image/$id")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204 }),
      GET: async ({ params }) => {
        const key = process.env.STATPAL_API_KEY;
        if (!key) return fallbackLeagueImage(params.id);
        const target = `https://statpal.io/api/v2/soccer/images?type=league&id=${encodeURIComponent(params.id)}&access_key=${key}`;
        try {
          const res = await fetch(target, {
            headers: { Accept: "image/png, image/jpeg, image/webp, application/json" },
            redirect: "follow",
          });
          const ct = res.headers.get("content-type") || "";
          if (!res.ok || !res.body || ct.includes("application/json") || ct.includes("text/")) {
            return fallbackLeagueImage(params.id);
          }
          return new Response(res.body, {
            status: 200,
            headers: {
              "content-type": ct,
              "cache-control": "public, max-age=86400, s-maxage=604800, immutable",
            },
          });
        } catch {
          return fallbackLeagueImage(params.id);
        }
      },
    },
  },
});
