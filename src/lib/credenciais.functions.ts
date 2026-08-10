import { createServerFn } from "@tanstack/react-start";

export type CredItem = { name: string; value: string; configured: boolean };

const NAMES = [
  "SMARTGREEN_API_KEY",
  "STATPAL_API_KEY",
  "FEEDODDS_H2BET_BRAND_ID",
  "FEEDODDS_H2BET_KEY",
  "FEEDODDS_SEUBET_BRAND_ID",
  "FEEDODDS_SEUBET_KEY",
  "PROXY_HOST",
  "PROXY_PORT",
  "PROXY_USER",
  "PROXY_PASS",
];

export const getCredenciais = createServerFn({ method: "GET" }).handler(async (): Promise<CredItem[]> => {
  return NAMES.map((name) => {
    const value = process.env[name] ?? "";
    return { name, value, configured: Boolean(value) };
  });
});
