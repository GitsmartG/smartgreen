import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/poll-live-notifications")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = request.headers.get("apikey");
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!apiKey || !expected || apiKey !== expected) {
          return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        try {
          const { collectLiveNotifications } = await import("@/lib/live-notifications.server");
          const url = new URL(request.url);
          const result = await collectLiveNotifications(url.origin, true);
          return Response.json({
            ok: true,
            fetchedAt: result.fetchedAt,
            freshCount: result.freshNotifications.length,
            matchesCount: result.matchesCount,
          });
        } catch (e) {
          return Response.json(
            { ok: false, error: e instanceof Error ? e.message : "erro" },
            { status: 500 },
          );
        }
      },
    },
  },
});