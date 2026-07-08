import { createFileRoute } from "@tanstack/react-router";
import { buildCors, requireApiKey } from "@/lib/api-auth";

export const Route = createFileRoute("/api/public/mobile/notifications/live")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) =>
        new Response(null, { status: 204, headers: buildCors(request) }),
      GET: async ({ request }) => {
        const cors = buildCors(request);
        const unauth = await requireApiKey(request);
        if (unauth) return unauth;

        try {
          const url = new URL(request.url);
          const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 200, 1), 500);
          const includeMatchState = url.searchParams.get("include_match_state") !== "false";
          const recentHours = Math.min(Math.max(Number(url.searchParams.get("hours")) || 12, 1), 72);
          const since = url.searchParams.get("since");
          const fetchedAt = new Date().toISOString();

          const { collectLiveNotifications, readLiveNotifications } = await import("@/lib/live-notifications.server");
          const collected = await collectLiveNotifications(url.origin, includeMatchState);
          const sinceDate = since ? new Date(since) : null;
          const threshold = sinceDate && !Number.isNaN(sinceDate.getTime())
            ? sinceDate
            : new Date(Date.now() - recentHours * 60 * 60 * 1000);
          const notifications = await readLiveNotifications(limit, threshold.toISOString());

          return new Response(
            JSON.stringify({
              ok: true,
              fetchedAt,
              count: notifications.length,
              freshCount: collected.freshNotifications.length,
              matchesCount: collected.matchesCount,
              notifications,
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                "Cache-Control": "no-store, max-age=0",
                Pragma: "no-cache",
                ...cors,
              },
            },
          );
        } catch (e) {
          return new Response(
            JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "erro" }),
            { status: 500, headers: { "Content-Type": "application/json", ...cors } },
          );
        }
      },
    },
  },
});