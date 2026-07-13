import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { FEATURE_KEYS, FEATURE_DEFAULTS, type FeatureKey, type FeatureFlags } from "./feature-flags";

export { FEATURE_KEYS, FEATURE_DEFAULTS };
export type { FeatureKey, FeatureFlags };

function publicClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

export const getFeatureFlags = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  const { data, error } = await sb.from("feature_flags").select("key,enabled");
  if (error) return FEATURE_DEFAULTS;
  const out: FeatureFlags = { ...FEATURE_DEFAULTS };
  for (const row of data ?? []) {
    if ((FEATURE_KEYS as string[]).includes(row.key)) {
      out[row.key as FeatureKey] = Boolean(row.enabled);
    }
  }
  return out;
});

export const setFeatureFlag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { key: FeatureKey; enabled: boolean }) => {
    if (!FEATURE_KEYS.includes(d.key)) throw new Error("Invalid key");
    return { key: d.key, enabled: Boolean(d.enabled) };
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("feature_flags")
      .upsert({ key: data.key, enabled: data.enabled, updated_at: new Date().toISOString() });
    if (error) throw error;
    return { ok: true };
  });
