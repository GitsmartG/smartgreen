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
};

export const checkIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ isAdmin: boolean }> => {
    const { data, error } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (error) return { isAdmin: false };
    return { isAdmin: !!data };
  });

export const listAdminUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: boolean; users?: AdminUserRow[]; error?: string }> => {
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
