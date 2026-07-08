// Devolve dados públicos de integração (FeedOdds + Proxy).
// Não são secrets — são compartilhados com alunos.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const body = {
    feedoddsH2betKey: Deno.env.get("FEEDODDS_H2BET_KEY") ?? "",
    feedoddsH2betBrandId: Deno.env.get("FEEDODDS_H2BET_BRAND_ID") ?? "",
    feedoddsSeubetKey: Deno.env.get("FEEDODDS_SEUBET_KEY") ?? "",
    feedoddsSeubetBrandId: Deno.env.get("FEEDODDS_SEUBET_BRAND_ID") ?? "",
    proxyHost: Deno.env.get("PROXY_HOST") ?? "",
    proxyPort: Deno.env.get("PROXY_PORT") ?? "",
    proxyUser: Deno.env.get("PROXY_USER") ?? "",
    proxyPass: Deno.env.get("PROXY_PASS") ?? "",
  };
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json", ...CORS },
  });
});
