// Helper de autenticação e CORS para os endpoints públicos /api/public/*.
// Usa a env SMARTGREEN_API_KEY (gerada via generate_secret) como bearer/x-api-key.

const ALLOWED_ORIGINS = [
  "https://smartgreen-phi.vercel.app",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:8080",
];

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  // Aceita qualquer preview do vercel (*.vercel.app) e previews do lovable
  if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)) return true;
  if (/^https:\/\/[a-z0-9-]+\.lovable\.app$/i.test(origin)) return true;
  if (/^https:\/\/[a-z0-9-]+\.lovableproject\.com$/i.test(origin)) return true;
  return false;
}

export function buildCors(request: Request): Record<string, string> {
  const origin = request.headers.get("origin");
  const allow = isAllowedOrigin(origin) ? origin! : "*";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function extractKey(request: Request): string | null {
  const header =
    request.headers.get("x-api-key") ||
    request.headers.get("X-Api-Key") ||
    request.headers.get("apikey");
  if (header) return header.trim();
  const auth = request.headers.get("authorization");
  if (auth && /^Bearer\s+/i.test(auth)) return auth.replace(/^Bearer\s+/i, "").trim();
  // Fallback via query string (?api_key=) — útil pra abrir no browser.
  try {
    const url = new URL(request.url);
    const q = url.searchParams.get("api_key");
    if (q) return q.trim();
  } catch { /* noop */ }
  return null;
}

/**
 * Retorna Response 401/500 se a chave não bater; null se ok.
 */
export function requireApiKey(request: Request): Response | null {
  const expected = process.env.SMARTGREEN_API_KEY;
  const cors = buildCors(request);
  if (!expected) {
    return new Response(
      JSON.stringify({ ok: false, error: "SMARTGREEN_API_KEY não configurada no servidor" }),
      { status: 500, headers: { "Content-Type": "application/json", ...cors } },
    );
  }
  const provided = extractKey(request);
  if (!provided || provided !== expected) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "API key inválida ou ausente. Envie o header X-API-Key: <sua_chave>",
      }),
      { status: 401, headers: { "Content-Type": "application/json", ...cors } },
    );
  }
  return null;
}
