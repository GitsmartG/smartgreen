import { createFileRoute } from "@tanstack/react-router";

// ============================================================
// LOGOS DE LIGA — API própria (Statpal) não fornece.
// Estratégia:
//   1) Match direto por padrão em curated map (URLs estáveis do
//      TheSportsDB CDN + fallbacks conhecidos).
//   2) Se não achar, tenta TheSportsDB por país (?country=).
//   3) Fallback: SVG genérico bonitinho.
// Cache: 7 dias no CDN.
// ============================================================

const CDN = "https://r2.thesportsdb.com/images/media/league/badge";

// pattern (regex-friendly, já normalizado) -> URL direta
const CURATED: Array<{ test: RegExp; url: string }> = [
  // ===== Europa / mundial =====
  { test: /uefa.*champions|champions.*league|liga.*campe/, url: "https://upload.wikimedia.org/wikipedia/en/thumb/b/bf/UEFA_Champions_League.svg/240px-UEFA_Champions_League.svg.png" },
  { test: /uefa.*europa.*league|europa.*league(?!.*conf)/, url: "https://upload.wikimedia.org/wikipedia/en/thumb/8/8d/UEFA_Europa_League.svg/240px-UEFA_Europa_League.svg.png" },
  { test: /conference.*league/, url: "https://upload.wikimedia.org/wikipedia/en/thumb/6/62/UEFA_Europa_Conference_League.svg/240px-UEFA_Europa_Conference_League.svg.png" },
  { test: /uefa.*nations|nations.*league/, url: "https://upload.wikimedia.org/wikipedia/en/thumb/8/85/UEFA_Nations_League.svg/240px-UEFA_Nations_League.svg.png" },
  { test: /uefa.*super.*cup/, url: "https://upload.wikimedia.org/wikipedia/en/thumb/0/0f/UEFA_Super_Cup.svg/240px-UEFA_Super_Cup.svg.png" },
  { test: /fifa.*world.*cup|copa.*do.*mundo/, url: "https://upload.wikimedia.org/wikipedia/en/thumb/0/06/2026_FIFA_World_Cup_emblem.svg/240px-2026_FIFA_World_Cup_emblem.svg.png" },
  { test: /fifa.*club.*world/, url: "https://upload.wikimedia.org/wikipedia/en/thumb/5/58/FIFA_Club_World_Cup.svg/240px-FIFA_Club_World_Cup.svg.png" },
  { test: /friendl|amistoso/, url: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/Football_pictogram.svg/240px-Football_pictogram.svg.png" },
  { test: /euro.*qualif|eurocopa/, url: "https://upload.wikimedia.org/wikipedia/en/thumb/6/60/UEFA_Euro_2024_Logo.svg/240px-UEFA_Euro_2024_Logo.svg.png" },

  // ===== América do Sul =====
  { test: /libertadores/, url: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Conmebol_Libertadores_logo.svg/240px-Conmebol_Libertadores_logo.svg.png" },
  { test: /sudamericana|sul[- ]americana/, url: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/Copa_Sudamericana_logo_%282020%29.svg/240px-Copa_Sudamericana_logo_%282020%29.svg.png" },
  { test: /recopa.*sudamericana/, url: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8b/Recopa_Sudamericana_logo.svg/240px-Recopa_Sudamericana_logo.svg.png" },
  { test: /conmebol/, url: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/eb/CONMEBOL_logo.svg/240px-CONMEBOL_logo.svg.png" },

  // ===== Brasil =====
  { test: /brasileir.*(serie|série).*a|serie.*a.*bra|campeonato.*brasileiro|brasileir.o(?!.*b\b|.*c\b|.*d\b|.*women|.*fem)/, url: "https://upload.wikimedia.org/wikipedia/pt/thumb/9/9e/Brasileir%C3%A3o_Assai_logo.png/220px-Brasileir%C3%A3o_Assai_logo.png" },
  { test: /brasileir.*(serie|série).*b|serie.*b.*bra/, url: "https://upload.wikimedia.org/wikipedia/pt/thumb/2/26/Brasileir%C3%A3o_S%C3%A9rie_B.png/220px-Brasileir%C3%A3o_S%C3%A9rie_B.png" },
  { test: /brasileir.*(serie|série).*c/, url: `${CDN}/9v0dxs1608304467.png` },
  { test: /brasileir.*(serie|série).*d/, url: `${CDN}/l50edf1778447349.png` },
  { test: /copa.*do.*brasil/, url: "https://upload.wikimedia.org/wikipedia/pt/thumb/0/0d/Copa_do_Brasil_logo.svg/240px-Copa_do_Brasil_logo.svg.png" },
  { test: /paulist|campeonato.*paulista/, url: "https://upload.wikimedia.org/wikipedia/pt/thumb/8/8d/Campeonato_Paulista_2023.png/220px-Campeonato_Paulista_2023.png" },
  { test: /carioca/, url: "https://upload.wikimedia.org/wikipedia/pt/thumb/0/0b/Campeonato_Carioca_2020.png/220px-Campeonato_Carioca_2020.png" },
  { test: /gaucho|ga[uú]cho/, url: "https://upload.wikimedia.org/wikipedia/pt/thumb/f/f3/Campeonato_Ga%C3%BAcho_de_Futebol.png/220px-Campeonato_Ga%C3%BAcho_de_Futebol.png" },
  { test: /mineiro/, url: "https://upload.wikimedia.org/wikipedia/pt/thumb/9/94/Campeonato_Mineiro_de_Futebol_-_logotipo.png/220px-Campeonato_Mineiro_de_Futebol_-_logotipo.png" },

  // ===== Inglaterra =====
  { test: /premier.*league|english.*premier/, url: "https://upload.wikimedia.org/wikipedia/en/thumb/f/f2/Premier_League_Logo.svg/240px-Premier_League_Logo.svg.png" },
  { test: /championship|efl.*champ/, url: "https://upload.wikimedia.org/wikipedia/en/thumb/b/b5/EFL_Championship.svg/240px-EFL_Championship.svg.png" },
  { test: /efl.*(league.*one|league.*1)/, url: "https://upload.wikimedia.org/wikipedia/en/thumb/6/6d/EFL_League_One.svg/240px-EFL_League_One.svg.png" },
  { test: /efl.*(league.*two|league.*2)/, url: "https://upload.wikimedia.org/wikipedia/en/thumb/2/28/EFL_League_Two.svg/240px-EFL_League_Two.svg.png" },
  { test: /fa.*cup/, url: "https://upload.wikimedia.org/wikipedia/en/thumb/0/07/Emirates_FA_Cup.svg/240px-Emirates_FA_Cup.svg.png" },
  { test: /efl.*cup|carabao|league.*cup.*eng/, url: `${CDN}/x1va771565372556.png` },

  // ===== Espanha =====
  { test: /la.*liga|spanish.*la.*liga|primera.*divisi.n.*esp/, url: `${CDN}/ja4it51687628717.png` },
  { test: /segunda.*divisi|laliga.*2|la.*liga.*2/, url: "https://upload.wikimedia.org/wikipedia/en/thumb/6/61/Segunda_Divisi%C3%B3n_logo.svg/240px-Segunda_Divisi%C3%B3n_logo.svg.png" },
  { test: /copa.*del.*rey/, url: `${CDN}/2ikh3a1671782958.png` },
  { test: /supercopa.*espa|supercopa.*de.*espa/, url: "https://upload.wikimedia.org/wikipedia/en/thumb/1/13/Supercopa_de_Espa%C3%B1a_logo.svg/240px-Supercopa_de_Espa%C3%B1a_logo.svg.png" },

  // ===== Itália =====
  { test: /serie.*a.*ita|italian.*serie.*a|calcio.*serie.*a/, url: `${CDN}/67q3q21679951383.png` },
  { test: /serie.*b.*ita|italian.*serie.*b/, url: `${CDN}/uf5kph1598011132.png` },
  { test: /coppa.*italia/, url: `${CDN}/hrm1vo1692679408.png` },

  // ===== Alemanha =====
  { test: /bundesliga(?!.*2|.*ii)/, url: `${CDN}/teqh1b1679952008.png` },
  { test: /2\.?.*bundesliga|bundesliga.*2/, url: `${CDN}/hl40981534764789.png` },
  { test: /dfb.*pokal/, url: `${CDN}/tlczpm1780941454.png` },

  // ===== França =====
  { test: /ligue.*1|french.*ligue.*1|france.*premi|championnat.*france/, url: `${CDN}/9f7z9d1742983155.png` },
  { test: /ligue.*2|french.*ligue.*2/, url: `${CDN}/aofb771742983333.png` },
  { test: /coupe.*de.*france/, url: `${CDN}/l6fitb1546469041.png` },

  // ===== Portugal =====
  { test: /primeira.*liga|liga.*portugal|liga.*nos|liga.*bwin|portugal.*primeira/, url: "https://upload.wikimedia.org/wikipedia/en/thumb/8/84/Primeira_Liga.png/220px-Primeira_Liga.png" },
  { test: /taca.*de.*portugal|ta[çc]a.*portugal/, url: "https://upload.wikimedia.org/wikipedia/en/thumb/3/3b/Ta%C3%A7a_de_Portugal_logo.png/220px-Ta%C3%A7a_de_Portugal_logo.png" },

  // ===== Holanda / Bélgica / Escócia =====
  { test: /eredivisie/, url: "https://upload.wikimedia.org/wikipedia/en/thumb/6/61/Eredivisie_nieuw_logo_2017-.svg/240px-Eredivisie_nieuw_logo_2017-.svg.png" },
  { test: /jupiler|belgian.*pro.*league|belgium.*pro.*league/, url: `${CDN}/mjit7n1593634474.png` },
  { test: /scottish.*premier|spfl.*prem|scotland.*premier/, url: "https://upload.wikimedia.org/wikipedia/en/thumb/e/e5/Scottish_Premiership.svg/240px-Scottish_Premiership.svg.png" },

  // ===== América / Ásia / Turquia =====
  { test: /liga.*mx|mexican.*primera|mexico.*primera|liga.*bbva/, url: `${CDN}/mav5rx1686157960.png` },
  { test: /mls|major.*league.*soccer/, url: "https://upload.wikimedia.org/wikipedia/en/thumb/5/59/Major_League_Soccer_logo.svg/240px-Major_League_Soccer_logo.svg.png" },
  { test: /argentin.*(primera|liga.*profesional)|liga.*profesional.*argentina/, url: `${CDN}/bjcymx1707321159.png` },
  { test: /saudi.*(pro|professional).*league|saudi.arabian.*pro/, url: `${CDN}/w67i621701772123.png` },
  { test: /j1.*league|japanese.*j1/, url: `${CDN}/3j8bni1675170553.png` },
  { test: /turkish.*(super|s[uü]per).*lig|s[uü]per.*lig.*turk/, url: "https://upload.wikimedia.org/wikipedia/en/thumb/4/47/Super_Lig_logo.svg/240px-Super_Lig_logo.svg.png" },
];

function normalize(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function findCurated(name: string): string | null {
  const n = normalize(name);
  if (!n) return null;
  for (const c of CURATED) {
    if (c.test.test(n)) return c.url;
  }
  return null;
}

// Cache in-memory por processo (não persiste entre cold starts, mas ajuda)
const memo = new Map<string, string | null>();

async function fetchSportsDbBadgeByName(name: string): Promise<string | null> {
  const q = (name || "").trim();
  if (!q) return null;
  const key = `n:${normalize(q)}`;
  if (memo.has(key)) return memo.get(key) || null;
  try {
    const res = await fetch(
      `https://www.thesportsdb.com/api/v1/json/3/searchleagues.php?l=${encodeURIComponent(q)}`,
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) {
      memo.set(key, null);
      return null;
    }
    const data = (await res.json()) as {
      leagues?: Array<{ strLeague?: string; strLeagueAlternate?: string; strSport?: string; strBadge?: string }>;
    };
    const target = normalize(q);
    const soccer = (data.leagues ?? []).filter(
      (l) => (!l.strSport || /soccer|football/i.test(l.strSport)) && l.strBadge?.startsWith("http"),
    );
    let best: string | null = null;
    let exact: string | null = null;
    for (const l of soccer) {
      const cand = [l.strLeague, ...(l.strLeagueAlternate || "").split(",")]
        .map((s) => normalize(s || ""))
        .filter(Boolean);
      if (cand.some((c) => c === target)) {
        exact = l.strBadge!;
        break;
      }
      if (!best && cand.some((c) => c.includes(target) || target.includes(c))) {
        best = l.strBadge!;
      }
    }
    const url = exact || best || soccer[0]?.strBadge || null;
    memo.set(key, url);
    return url;
  } catch {
    return null;
  }
}

async function fetchSportsDbBadgeByCountry(name: string, country: string): Promise<string | null> {
  const key = `c:${normalize(country)}`;
  if (memo.has(key)) {
    return matchInCached(memo.get(key)!, name);
  }
  try {
    const res = await fetch(
      `https://www.thesportsdb.com/api/v1/json/3/search_all_leagues.php?c=${encodeURIComponent(country)}&s=Soccer`,
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) {
      memo.set(key, "");
      return null;
    }
    const data = (await res.json()) as {
      countries?: Array<{ strLeague?: string; strLeagueAlternate?: string; strBadge?: string }>;
    };
    // Serializa como lista compacta
    const flat = (data.countries ?? [])
      .filter((l) => l.strBadge?.startsWith("http"))
      .map((l) => `${l.strLeague}|${l.strLeagueAlternate || ""}|${l.strBadge}`)
      .join("\n");
    memo.set(key, flat);
    return matchInCached(flat, name);
  } catch {
    return null;
  }
}


function matchInCached(flat: string, name: string): string | null {
  if (!flat) return null;
  const target = normalize(name);
  if (!target) return null;
  const lines = flat.split("\n");
  // Preferir match exato, depois includes
  let best: string | null = null;
  for (const line of lines) {
    const [lg, alt, url] = line.split("|");
    const cand = [lg, ...(alt || "").split(",")].map((s) => normalize(s || "")).filter(Boolean);
    if (cand.some((c) => c === target)) return url;
    if (!best && cand.some((c) => c.includes(target) || target.includes(c))) best = url;
  }
  return best;
}

function fallbackSvg(id: string) {
  const label = String(id || "?").slice(-2).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96" role="img" aria-label="Liga">
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

async function proxyImage(url: string): Promise<Response | null> {
  try {
    const img = await fetch(url, {
      headers: { Accept: "image/png, image/jpeg, image/webp, image/svg+xml, */*" },
      redirect: "follow",
    });
    const ct = img.headers.get("content-type") || "";
    if (!img.ok || !img.body || !ct.startsWith("image/")) return null;
    return new Response(img.body, {
      status: 200,
      headers: {
        "content-type": ct,
        "cache-control": "public, max-age=86400, s-maxage=604800, immutable",
      },
    });
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
        const country = url.searchParams.get("country") || "";

        // 1) curated map (rápido, sem rede externa)
        const curated = findCurated(name);
        if (curated) {
          const r = await proxyImage(curated);
          if (r) return r;
        }

        // 2) TheSportsDB por país (quando informado)
        if (country) {
          const via = await fetchSportsDbBadgeByCountry(name, country);
          if (via) {
            const r = await proxyImage(via);
            if (r) return r;
          }
        }

        // 3) fallback svg
        return fallbackSvg(params.id);
      },
    },
  },
});
