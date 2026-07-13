export type FeatureKey = "jogos" | "ligas" | "banca" | "parceiros" | "indique";
export const FEATURE_KEYS: FeatureKey[] = ["jogos", "ligas", "banca", "parceiros", "indique"];
export type FeatureFlags = Record<FeatureKey, boolean>;
export const FEATURE_DEFAULTS: FeatureFlags = {
  jogos: true,
  ligas: true,
  banca: true,
  parceiros: true,
  indique: true,
};
