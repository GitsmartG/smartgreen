import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type AdminUserRow = {
  id: string;
  email: string;
  name: string | null;
  role: "admin" | "user";
  created_at: string;
  last_sign_in_at: string | null;
  access_expires_at: string | null;
};

export const checkIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (ctx): Promise<{ isAdmin: boolean }> => {
    const context = ctx?.context;
    if (!context) return { isAdmin: false };
    const { data, error } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (error) return { isAdmin: false };
    return { isAdmin: !!data };
  });


export const listAdminUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (ctx): Promise<{ ok: boolean; users?: AdminUserRow[]; error?: string }> => {
    const context = ctx?.context;
    if (!context) return { ok: false, error: "unauthorized" };
    const { data, error } = await context.supabase.rpc("admin_list_users");
    if (error) return { ok: false, error: error.message };
    return { ok: true, users: (data ?? []) as AdminUserRow[] };
  });


export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { targetId: string; role: "admin" | "user" }) =>
    z.object({
      targetId: z.string().uuid(),
      role: z.enum(["admin", "user"]),
    }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string }> => {
    const { error } = await context.supabase.rpc("admin_set_role", {
      _target: data.targetId,
      _role: data.role,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  });

export const deleteAppUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { targetId: string }) =>
    z.object({ targetId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string }> => {
    // só admin
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) return { ok: false, error: "forbidden" };
    if (data.targetId === context.userId) return { ok: false, error: "Você não pode se excluir." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.targetId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  });

export const createAppUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string; password: string; name?: string; role: "admin" | "user"; expiresAt: string | null }) =>
    z.object({
      email: z.string().email(),
      password: z.string().min(6, "Senha deve ter ao menos 6 caracteres"),
      name: z.string().trim().optional(),
      role: z.enum(["admin", "user"]),
      expiresAt: z.string().datetime().nullable(),
    }).parse(input) as { email: string; password: string; name?: string; role: "admin" | "user"; expiresAt: string | null },
  )
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string; userId?: string }> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) return { ok: false, error: "forbidden" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: data.name ? { name: data.name } : undefined,
    });
    if (error || !created?.user) return { ok: false, error: error?.message ?? "Erro ao criar usuário" };
    if (data.role === "admin") {
      await context.supabase.rpc("admin_set_role", { _target: created.user.id, _role: "admin" });
    }
    await context.supabase.rpc("admin_set_access_expiry", {
      _target: created.user.id,
      _expires_at: data.expiresAt as unknown as string,
    });
    return { ok: true, userId: created.user.id };
  });

export const setUserAccessExpiry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { targetId: string; expiresAt: string | null }) =>
    z.object({
      targetId: z.string().uuid(),
      expiresAt: z.string().datetime().nullable(),
    }).parse(input) as { targetId: string; expiresAt: string | null },
  )
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string }> => {
    const { error } = await context.supabase.rpc("admin_set_access_expiry", {
      _target: data.targetId,
      _expires_at: data.expiresAt as unknown as string,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  });
