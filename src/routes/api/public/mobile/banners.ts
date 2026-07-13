// GET /api/public/mobile/banners
// Lista banners ativos ordenados para o app mobile. Retorna signed URLs (7 dias).
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireApiKey, buildCors } from "@/lib/api-auth";

export const Route = createFileRoute("/api/public/mobile/banners")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) =>
        new Response(null, { status: 204, headers: buildCors(request) }),
      GET: async ({ request }) => {
        const cors = buildCors(request);
        const bad = await requireApiKey(request);
        if (bad) return bad;
        const sb = createClient<Database>(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
        );
        const { data, error } = await sb
          .from("banners")
          .select("id,image_url,link_url,button_label,title,sort_order,created_at")
          .eq("active", true)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: false });
        if (error) {
          return new Response(
            JSON.stringify({ ok: false, error: error.message }),
            { status: 500, headers: { "Content-Type": "application/json", ...cors } },
          );
        }
        // Precisamos de service role pra gerar signed URLs de bucket privado.
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const banners = await Promise.all((data ?? []).map(async (row) => {
          let image_url = row.image_url;
          if (image_url?.startsWith("bucket://")) {
            const path = image_url.replace(/^bucket:\/\//, "");
            const { data: signed } = await supabaseAdmin.storage
              .from("banners")
              .createSignedUrl(path, 60 * 60 * 24 * 7);
            image_url = signed?.signedUrl ?? "";
          }
          const has_button = Boolean(row.button_label && row.button_label.trim().length > 0);
          return {
            id: row.id,
            title: row.title,
            image_url,
            link_url: row.link_url,
            button_label: has_button ? row.button_label : null,
            has_button,
            sort_order: row.sort_order,
          };
        }));
        return new Response(
          JSON.stringify({ ok: true, count: banners.length, banners }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "cache-control": "public, max-age=60",
              ...cors,
            },
          },
        );
      },
    },
  },
});
