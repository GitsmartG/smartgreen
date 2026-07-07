import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type LineupPlayer = {
  id?: string;
  name?: string;
  number?: string;
  position?: string;
};

export type SidelinedPlayer = LineupPlayer & {
  status?: string;
  reason?: string | null;
};

export type TeamLineup = {
  team_id?: string;
  team_name?: string;
  coach?: { name?: string; id?: string };
  team_formation?: string;
  starting_xi?: LineupPlayer[];
  bench?: LineupPlayer[];
  sidelined?: SidelinedPlayer[];
  confidence?: number;
};

export type LineupsResult = {
  ok: boolean;
  error?: string;
  status?: string;
  updated?: string;
  home?: TeamLineup;
  away?: TeamLineup;
};

export const getMatchLineups = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ matchId: z.string().min(1) }).parse(input))
  .handler(async ({ data }): Promise<LineupsResult> => {
    const { fetchMatchLineups } = await import("./statpal-lineups.server");
    return fetchMatchLineups(data.matchId);
  });
