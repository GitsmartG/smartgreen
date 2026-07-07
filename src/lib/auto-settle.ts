import type { Ticket, TipStatus } from "./tickets-store";
import type { LiveMatch } from "./livescores.functions";

function normalize(s: string): string {
  const base = s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return base
    .replace(/\begito\b/g, "egypt")
    .replace(/\bestados unidos\b|\beua\b/g, "usa")
    .replace(/\bbelgica\b/g, "belgium")
    .replace(/\balemanha\b/g, "germany")
    .replace(/\bespanha\b/g, "spain")
    .replace(/\bfranca\b/g, "france")
    .replace(/\binglaterra\b/g, "england")
    .replace(/\bitalia\b/g, "italy")
    .replace(/\bholanda\b|\bpaises baixos\b/g, "netherlands");
}

function tokens(s: string): string[] {
  return normalize(s)
    .split(" ")
    .filter((t) => t.length >= 3 && !["multipla", "simples", "time", "mais", "menos", "total", "jogo"].includes(t));
}

function nameMatch(a: string, b: string): boolean {
  const ta = new Set(tokens(a));
  const tb = tokens(b);
  if (!tb.length) return false;
  let hits = 0;
  for (const t of tb) if (ta.has(t)) hits++;
  return hits >= Math.min(1, tb.length);
}

function isUngradeableMarket(p: string): boolean {
  return /escanteio|corner|cartao|cartão|amarelo|vermelho|impedimento|lateral|chute|finalizacao|finalização/.test(p);
}

export function gradeSinglePalpite(palpite: string, match: LiveMatch, ticket: Ticket): TipStatus | null {
  if (!match.finished || match.score1 == null || match.score2 == null) return null;

  const parts = ticket.event.split(/\s+(?:vs|x|×|-)\s+/i);
  const tHome = parts[0] ?? "";
  const tAway = parts[1] ?? "";
  const swap = nameMatch(match.team1, tAway) && nameMatch(match.team2, tHome);
  const homeScore = swap ? match.score2 : match.score1;
  const awayScore = swap ? match.score1 : match.score2;
  const total = homeScore + awayScore;

  const p = normalize(palpite);
  if (isUngradeableMarket(p)) return null;

  // Empate
  if (/\bempate\b|\bdraw\b/.test(p)) {
    return homeScore === awayScore ? "green" : "red";
  }

  // Ambas marcam / BTTS
  if (/ambas\s+marcam|both.*score|btts/.test(p)) {
    const yes = /\b(sim|yes)\b/.test(p) || !/\b(nao|não|no)\b/.test(p);
    const both = homeScore > 0 && awayScore > 0;
    return (both === yes) ? "green" : "red";
  }

  // Over/Under gols
  const ou = p.match(/\b(over|mais|acima|under|menos|abaixo)\s*(?:de\s*)?\(?\s*(\d+(?:[.,\s]\d+)?)\s*\)?/);
  if (ou) {
    const isOver = /over|mais|acima/.test(ou[1]);
    const line = Number(ou[2].replace(/\s+/, ".").replace(",", "."));
    if (!Number.isNaN(line)) {
      if (isOver) return total > line ? "green" : "red";
      return total < line ? "green" : "red";
    }
  }

  // Vitória/vencedor: <time> ou "casa"/"fora"
  if (/vitoria|vencedor|winner|ganha|vence/.test(p) || /\b1\s*x\s*2\b/.test(p)) {
    if (/\bcasa\b|\bhome\b|\bmandante\b/.test(p)) {
      return homeScore > awayScore ? "green" : "red";
    }
    if (/\bfora\b|\baway\b|\bvisitante\b/.test(p)) {
      return awayScore > homeScore ? "green" : "red";
    }
    if (nameMatch(tHome, p)) return homeScore > awayScore ? "green" : "red";
    if (nameMatch(tAway, p)) return awayScore > homeScore ? "green" : "red";
  }

  // Menção simples ao time (fallback: assume vitória do time citado)
  if (nameMatch(tHome, p) && !nameMatch(tAway, p)) {
    return homeScore > awayScore ? "green" : "red";
  }
  if (nameMatch(tAway, p) && !nameMatch(tHome, p)) {
    return awayScore > homeScore ? "green" : "red";
  }

  return null;
}

export function findMatchForTicket(t: Ticket, matches: LiveMatch[]): LiveMatch | null {
  const parts = t.event.split(/\s+(?:vs|x|×|-)\s+/i);
  const t1 = parts[0] ?? "";
  const t2 = parts[1] ?? "";
  for (const m of matches) {
    const direct = nameMatch(m.team1, t1) && nameMatch(m.team2, t2);
    const swap = nameMatch(m.team1, t2) && nameMatch(m.team2, t1);
    if (direct || swap) return m;
  }

  const haystack = `${t.event} ${t.league} ${t.palpite}`;
  const partial = matches.filter((m) => nameMatch(m.team1, haystack) || nameMatch(m.team2, haystack));
  if (partial.length === 1) return partial[0];
  const finished = partial.filter((m) => m.finished);
  if (finished.length === 1) return finished[0];
  return null;
}

/**
 * Try to grade a palpite against a finished match.
 * Returns green/red/null (null = couldn't decide).
 */
export function gradePalpite(
  palpite: string,
  match: LiveMatch,
  ticket: Ticket,
): TipStatus | null {
  if (!match.finished || match.score1 == null || match.score2 == null) return null;
  const parts = palpite
    .split(/\r?\n|;| \+ | \/ | \| /g)
    .map((p) => p.trim())
    .filter(Boolean);
  const picks = parts.length ? parts : [palpite];
  const graded = picks.map((p) => gradeSinglePalpite(p, match, ticket));
  if (graded.some((g) => g === "red")) return "red";
  if (graded.every((g) => g === "green")) return "green";
  return null;
}
