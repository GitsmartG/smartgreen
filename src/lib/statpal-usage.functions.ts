import { createServerFn } from "@tanstack/react-start";

export type StatpalUsage = {
  ok: boolean;
  error?: string;
  requestCount?: number;
  currentDate?: string;
};

export const getStatpalUsage = createServerFn({ method: "GET" }).handler(async (): Promise<StatpalUsage> => {
  const key = process.env.STATPAL_API_KEY;
  if (!key) return { ok: false, error: "STATPAL_API_KEY não configurada" };
  try {
    const res = await fetch(
      `https://statpal.io/api/user-request-count?access_key=${encodeURIComponent(key)}`,
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const data = (await res.json()) as { request_count?: number; current_date?: string };
    return {
      ok: true,
      requestCount: typeof data.request_count === "number" ? data.request_count : 0,
      currentDate: data.current_date,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao consultar Statpal" };
  }
});
