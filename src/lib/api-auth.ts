// Helper de autenticação e CORS para os endpoints públicos /api/public/*.
// A chave fica na tabela public.api_keys (gerenciada pelo admin).

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const ALLOWED_ORIGINS = [
  "https://smartgreen-phi.vercel.app",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:8080",
];

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
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
  try {
    const url = new URL(request.url);
    const q = url.searchParams.get("api_key");
    if (q) return q.trim();
  } catch { /* noop */ }
  return null;
}

// Cache em memória: 30s
let cache: { keys: Set<string>; expiresAt: number } | null = null;

async function loadActiveKeys(): Promise<Set<string>> {
  if (cache && cache.expiresAt > Date.now()) return cache.keys;
  const sb = createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
  // policy só libera pra authenticated → usar service role
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const client = supabaseAdmin ?? sb;
  const { data } = await client.from("api_keys").select("key").eq("active", true);
  const keys = new Set<string>((data ?? []).map((r) => r.key));
  cache = { keys, expiresAt: Date.now() + 30_000 };
  return keys;
}

/** Retorna Response 401/500 se a chave não bater; null se ok. */
export async function requireApiKey(request: Request): Promise<Response | null> {
  const cors = buildCors(request);
  const provided = extractKey(request);
  if (!provided) {
    return new Response(
      JSON.stringify({ ok: false, error: "API key ausente. Envie o header X-API-Key: <sua_chave>" }),
      { status: 401, headers: { "Content-Type": "application/json", ...cors } },
    );
  }
  try {
    const keys = await loadActiveKeys();
    if (!keys.has(provided)) {
      return new Response(
        JSON.stringify({ ok: false, error: "API key inválida." }),
        { status: 401, headers: { "Content-Type": "application/json", ...cors } },
      );
    }
    return null;
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "erro validando chave" }),
      { status: 500, headers: { "Content-Type": "application/json", ...cors } },
    );
  }
}

/** Invalida o cache — chamar após gerar/rotacionar chave. */
export function invalidateApiKeyCache() {
  cache = null;
}
