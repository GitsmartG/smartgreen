import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Retorna a SMARTGREEN_API_KEY pro admin logado copiar e colar
 * no site Vercel / app mobile. Só usuários autenticados enxergam.
 */
export const getInternalApiKey = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const key = process.env.SMARTGREEN_API_KEY ?? "";
    return { key, configured: Boolean(key) };
  });
