import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const bodySchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(6).max(128),
  name: z.string().trim().min(1).max(120).optional(),
});

function cors(res: Response): Response {
  res.headers.set("access-control-allow-origin", "*");
  res.headers.set("access-control-allow-headers", "content-type, apikey, authorization");
  res.headers.set("access-control-allow-methods", "POST, OPTIONS");
  return res;
}

export const Route = createFileRoute("/api/public/mobile/signup")({
  server: {
    handlers: {
      OPTIONS: async () => cors(new Response(null, { status: 204 })),
      POST: async ({ request }) => {
        let payload: unknown;
        try {
          payload = await request.json();
        } catch {
          return cors(Response.json({ ok: false, error: "JSON inválido" }, { status: 400 }));
        }
        const parsed = bodySchema.safeParse(payload);
        if (!parsed.success) {
          return cors(Response.json({ ok: false, error: "Dados inválidos" }, { status: 400 }));
        }

        const url = process.env.SUPABASE_URL;
        const anon = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!url || !anon) {
          return cors(Response.json({ ok: false, error: "Servidor mal configurado" }, { status: 500 }));
        }
        const client = createClient(url, anon, {
          auth: { persistSession: false, autoRefreshToken: false },
        });

        const { data, error } = await client.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: { data: parsed.data.name ? { name: parsed.data.name } : undefined },
        });
        if (error) {
          return cors(Response.json({ ok: false, error: error.message }, { status: 400 }));
        }

        return cors(Response.json({
          ok: true,
          access_token: data.session?.access_token ?? null,
          refresh_token: data.session?.refresh_token ?? null,
          expires_at: data.session?.expires_at ?? null,
          user: data.user ? { id: data.user.id, email: data.user.email, role: "user" } : null,
          needs_email_confirmation: !data.session,
        }));
      },
    },
  },
});
