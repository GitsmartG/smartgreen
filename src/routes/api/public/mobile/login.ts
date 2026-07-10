import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const bodySchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(6).max(128),
});

function cors(res: Response): Response {
  res.headers.set("access-control-allow-origin", "*");
  res.headers.set("access-control-allow-headers", "content-type, apikey, authorization");
  res.headers.set("access-control-allow-methods", "POST, OPTIONS");
  return res;
}

export const Route = createFileRoute("/api/public/mobile/login")({
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
          return cors(Response.json({ ok: false, error: "email/senha inválidos" }, { status: 400 }));
        }

        const url = process.env.SUPABASE_URL;
        const anon = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!url || !anon) {
          return cors(Response.json({ ok: false, error: "Servidor mal configurado" }, { status: 500 }));
        }

        const client = createClient(url, anon, {
          auth: { persistSession: false, autoRefreshToken: false },
        });

        const { data, error } = await client.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });
        if (error || !data.session) {
          return cors(Response.json({ ok: false, error: "Email ou senha incorretos" }, { status: 401 }));
        }

        // Verifica validade de acesso
        const { data: prof } = await client
          .from("profiles")
          .select("access_expires_at")
          .eq("id", data.user!.id)
          .maybeSingle();
        if (prof?.access_expires_at && new Date(prof.access_expires_at).getTime() < Date.now()) {
          await client.auth.signOut();
          return cors(Response.json({
            ok: false,
            error: "access_expired",
            message: "Seu acesso expirou. Contate o suporte.",
            access_expires_at: prof.access_expires_at,
          }, { status: 403 }));
        }

        // Descobre role
        const { data: hasAdmin } = await client.rpc("has_role", {
          _user_id: data.user!.id,
          _role: "admin",
        });

        return cors(Response.json({
          ok: true,
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: data.session.expires_at,
          expires_in: data.session.expires_in,
          user: {
            id: data.user!.id,
            email: data.user!.email,
            role: hasAdmin ? "admin" : "user",
            access_expires_at: prof?.access_expires_at ?? null,
          },
        }));
      },
    },
  },
});
