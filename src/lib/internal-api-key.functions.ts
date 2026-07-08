import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Retorna a chave ativa atual pro admin logado. */
export const getInternalApiKey = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("api_keys")
      .select("key")
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return { key: data?.key ?? "", configured: Boolean(data?.key) };
  });

/** Gera uma nova chave (48 chars hex), marca as antigas como inativas. */
export const regenerateApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // gera 32 bytes → 64 chars hex
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const key = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

    // desativa antigas
    await context.supabase.from("api_keys").update({ active: false }).eq("active", true);
    // insere nova
    const { data, error } = await context.supabase
      .from("api_keys")
      .insert({ key, active: true })
      .select("key")
      .single();
    if (error) throw error;
    return { key: data.key };
  });
