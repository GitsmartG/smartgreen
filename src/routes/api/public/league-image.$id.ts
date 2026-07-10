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

// A Statpal não expõe imagem de liga — só de time. Usamos TheSportsDB (grátis, sem chave)
// buscando pelo NOME da liga. Chamada: /api/public/league-image/{id}?name=Brasileir%C3%A3o
async function fetchSportsDbBadge(name: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://www.thesportsdb.com/api/v1/json/3/search_all_leagues.php?s=Soccer`,
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { countries?: Array<{ strLeague?: string; strBadge?: string }> };
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const target = norm(name);
    const hit = (data.countries ?? []).find((l) => {
      const n = norm(l.strLeague ?? "");
      return n && (n === target || n.includes(target) || target.includes(n));
    });
    return hit?.strBadge && hit.strBadge.startsWith("http") ? hit.strBadge : null;
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/api/public/league-image/$id")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204 }),
      GET: async ({ params, request }) => {
        const url = new URL(request.url);
        const name = url.searchParams.get("name") || "";
        if (!name) return fallbackLeagueImage(params.id);
        try {
          const badgeUrl = await fetchSportsDbBadge(name);
          if (!badgeUrl) return fallbackLeagueImage(params.id);
          const img = await fetch(badgeUrl, {
            headers: { Accept: "image/png, image/jpeg, image/webp" },
            redirect: "follow",
          });
          const ct = img.headers.get("content-type") || "";
          if (!img.ok || !img.body || !ct.startsWith("image/")) {
            return fallbackLeagueImage(params.id);
          }
          return new Response(img.body, {
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
