// Configuração de casas de aposta (bets) com btag de afiliado.
// Persiste no localStorage. Usado tanto no painel de Configurações quanto
// na criação/exibição de tickets para injetar a btag quando a URL não tem.

export type BetConfig = {
  id: string;            // slug estável (ex.: "seubet", "h2bet") — casa com Parceiro
  name: string;          // nome exibido
  domain: string;        // domínio do afiliado (ex.: "h2.bet.br")
  affiliatePath: string; // caminho do afiliado (ex.: "/affiliates/")
  btag: string;          // sua btag / código de indicação
};

const STORAGE_KEY = "sg-bets";

export const DEFAULT_BETS: BetConfig[] = [
  { id: "seubet", name: "SeuBet", domain: "seubet.com",  affiliatePath: "/affiliates/", btag: "" },
  { id: "h2bet",  name: "H2Bet",  domain: "h2.bet.br",   affiliatePath: "/affiliates/", btag: "" },
];

export function loadBets(): BetConfig[] {
  if (typeof window === "undefined") return DEFAULT_BETS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_BETS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_BETS;
    // merge com defaults pra garantir seubet + h2bet sempre presentes
    const byId = new Map<string, BetConfig>();
    for (const b of DEFAULT_BETS) byId.set(b.id, { ...b });
    for (const b of parsed as Partial<BetConfig>[]) {
      if (!b || typeof b.id !== "string") continue;
      const prev = byId.get(b.id) ?? { id: b.id, name: b.id, domain: "", affiliatePath: "/affiliates/", btag: "" };
      byId.set(b.id, {
        id: b.id,
        name: typeof b.name === "string" && b.name ? b.name : prev.name,
        domain: typeof b.domain === "string" ? b.domain : prev.domain,
        affiliatePath: typeof b.affiliatePath === "string" && b.affiliatePath ? b.affiliatePath : prev.affiliatePath,
        btag: typeof b.btag === "string" ? b.btag : prev.btag,
      });
    }
    return Array.from(byId.values());
  } catch {
    return DEFAULT_BETS;
  }
}

export function saveBets(bets: BetConfig[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bets));
  try { window.dispatchEvent(new Event("sg-bets-changed")); } catch { /* noop */ }
}

/**
 * Se a URL não tiver `btag`, devolve a URL de afiliado com a btag configurada
 * (ex.: https://h2.bet.br/affiliates/?btag=XXXX). Senão, devolve a URL original.
 * Se não achar a bet configurada ou não tiver btag cadastrada, devolve a URL original.
 */
export function applyBtag(url: string | null | undefined, parceiroId?: string | null): string {
  if (!url || typeof url !== "string") return url ?? "";
  const bets = loadBets();
  let bet: BetConfig | undefined;
  try {
    const u = new URL(url);
    if (u.searchParams.has("btag") && u.searchParams.get("btag")) return url;
    if (parceiroId) bet = bets.find((b) => b.id === parceiroId);
    if (!bet) bet = bets.find((b) => b.domain && u.hostname.endsWith(b.domain));
  } catch {
    if (parceiroId) bet = bets.find((b) => b.id === parceiroId);
  }
  if (!bet || !bet.btag || !bet.domain) return url;
  const path = bet.affiliatePath.startsWith("/") ? bet.affiliatePath : `/${bet.affiliatePath}`;
  return `https://${bet.domain}${path}?btag=${encodeURIComponent(bet.btag)}`;
}
