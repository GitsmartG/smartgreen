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

function parseOverUnder(p: string): { isOver: boolean; line: number } | null {
  const ou = p.match(/\b(over|mais|acima|under|menos|abaixo)\s*(?:de\s*)?\(?\s*(\d+(?:[.,\s]\d+)?)\s*\)?/);
  if (!ou) return null;
  const isOver = /over|mais|acima/.test(ou[1]);
  const line = Number(ou[2].replace(/\s+/, ".").replace(",", "."));
  if (!Number.isFinite(line)) return null;
  return { isOver, line };
}

export function gradeSinglePalpite(palpite: string, match: LiveMatch, ticket: Ticket): TipStatus | null {
  // Precisa ter placar disponível (mesmo ao vivo).
  if (match.score1 == null || match.score2 == null) return null;

  // Apostas só valem no tempo normal. Prorrogação/pênaltis não contam.
  // Se o jogo foi pra ET/AET/PEN, não podemos afirmar o placar dos 90min
  // com base no placar final — melhor não gradar automaticamente.
  const st = (match.status || "").toLowerCase();
  const wentToExtra = /\baet\b|\bet\b|\bpen\b|extra\s*time|prorroga|penalt|shootout|after.*extra/.test(st);
  if (wentToExtra) return null;

  const parts = ticket.event.split(/\s+(?:vs|x|×|-)\s+/i);
  const tHome = parts[0] ?? "";
  const tAway = parts[1] ?? "";
  const swap = nameMatch(match.team1, tAway) && nameMatch(match.team2, tHome);
  const homeScore = swap ? match.score2 : match.score1;
  const awayScore = swap ? match.score1 : match.score2;
  const totalGoals = homeScore + awayScore;

  const p = normalize(palpite);
  const finished = match.finished;

  // ============ MERCADOS QUE PERMITEM GREEN ANTECIPADO ============

  // Escanteios total (over antecipado)
  if (/escanteio|corner/.test(p)) {
    const ou = parseOverUnder(p);
    if (!ou) return null;
    const c1 = swap ? match.corners2 : match.corners1;
    const c2 = swap ? match.corners1 : match.corners2;
    if (c1 == null || c2 == null) return finished ? null : null;
    const total = c1 + c2;
    if (ou.isOver) {
      if (total > ou.line) return "green"; // já bateu
      return finished ? "red" : null; // só red quando acabar
    }
    // under: só resolve no fim
    return finished ? (total < ou.line ? "green" : "red") : null;
  }

  // Cartões total (over antecipado)
  if (/cartao|cartão|amarelo|vermelho|card/.test(p)) {
    const ou = parseOverUnder(p);
    if (!ou) return null;
    const y1 = swap ? match.yellow2 : match.yellow1;
    const y2 = swap ? match.yellow1 : match.yellow2;
    const r1 = swap ? match.red2 : match.red1;
    const r2 = swap ? match.red1 : match.red2;
    if (y1 == null || y2 == null) return null;
    const total = (y1 ?? 0) + (y2 ?? 0) + (r1 ?? 0) + (r2 ?? 0);
    if (ou.isOver) {
      if (total > ou.line) return "green";
      return finished ? "red" : null;
    }
    return finished ? (total < ou.line ? "green" : "red") : null;
  }

  // Chutes/finalizações
  if (/chute|finalizacao|finalização|shot/.test(p)) {
    const ou = parseOverUnder(p);
    if (!ou) return null;
    const s1 = swap ? match.shots2 : match.shots1;
    const s2 = swap ? match.shots1 : match.shots2;
    if (s1 == null || s2 == null) return null;
    const total = s1 + s2;
    if (ou.isOver) {
      if (total > ou.line) return "green";
      return finished ? "red" : null;
    }
    return finished ? (total < ou.line ? "green" : "red") : null;
  }

  // Impedimento / lateral — não tem stats, só resolve no fim (e mesmo assim é raro)
  if (/impedimento|lateral/.test(p)) return null;

  // BTTS / Ambas marcam
  if (/ambas\s+marcam|both.*score|btts/.test(p)) {
    const yes = /\b(sim|yes)\b/.test(p) || !/\b(nao|não|no)\b/.test(p);
    const both = homeScore > 0 && awayScore > 0;
    if (yes && both) return "green"; // já aconteceu
    if (!yes && both) return "red"; // já quebrou
    return finished ? (both === yes ? "green" : "red") : null;
  }

  // Over/Under de gols
  const ouGoals = parseOverUnder(p);
  if (ouGoals && /gol|goal|total/.test(p) === false) {
    // sem palavra explícita → ainda tratamos como gols se não caiu em outros mercados
  }
  if (ouGoals) {
    if (ouGoals.isOver) {
      if (totalGoals > ouGoals.line) return "green"; // green antecipado
      return finished ? "red" : null;
    }
    return finished ? (totalGoals < ouGoals.line ? "green" : "red") : null;
  }

  // ============ MERCADOS QUE SÓ RESOLVEM NO FIM ============
  if (!finished) return null;

  // Empate
  if (/\bempate\b|\bdraw\b/.test(p)) {
    return homeScore === awayScore ? "green" : "red";
  }

  // Vitória/vencedor
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

  // Fallback: menção ao time
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
 * Grade a full palpite (pode ter múltiplas seleções separadas por + / | ;).
 * Retorna green apenas se TODAS forem green. Red se qualquer uma for red.
 */
export function gradePalpite(
  palpite: string,
  match: LiveMatch,
  ticket: Ticket,
): TipStatus | null {
  if (match.score1 == null || match.score2 == null) return null;
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
