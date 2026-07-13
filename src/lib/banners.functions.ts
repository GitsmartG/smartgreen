import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type BannerDTO = {
  id: string;
  image_url: string;
  storage_path: string | null;
  link_url: string | null;
  button_label: string | null;
  title: string | null;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

async function toDTO(
  supabase: { storage: { from: (b: string) => { createSignedUrl: (p: string, s: number) => Promise<{ data: { signedUrl: string } | null }> } } },
  row: {
    id: string; image_url: string; link_url: string | null;
    button_label: string | null; title: string | null;
    active: boolean; sort_order: number; created_at: string; updated_at: string;
  },
): Promise<BannerDTO> {
  let publicUrl = row.image_url;
  let storagePath: string | null = null;
  if (row.image_url.startsWith("bucket://")) {
    storagePath = row.image_url.replace(/^bucket:\/\//, "");
    const { data } = await supabase.storage.from("banners").createSignedUrl(storagePath, 60 * 60 * 24 * 7);
    publicUrl = data?.signedUrl ?? "";
  }
  return {
    id: row.id,
    image_url: publicUrl,
    storage_path: storagePath,
    link_url: row.link_url,
    button_label: row.button_label,
    title: row.title,
    active: row.active,
    sort_order: row.sort_order,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export const listBannersAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("banners")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) throw error;
    return Promise.all((data ?? []).map((r) => toDTO(context.supabase, r)));
  });

export const upsertBanner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    id?: string;
    image_url: string;
    link_url?: string | null;
    button_label?: string | null;
    title?: string | null;
    active?: boolean;
    sort_order?: number;
  }) => {
    if (!d.image_url || typeof d.image_url !== "string") throw new Error("image_url obrigatório");
    return d;
  })
  .handler(async ({ data, context }) => {
    const payload = {
      image_url: data.image_url,
      link_url: data.link_url ?? null,
      button_label: data.button_label ?? null,
      title: data.title ?? null,
      active: data.active ?? true,
      sort_order: data.sort_order ?? 0,
    };
    const { data: row, error } = data.id
      ? await context.supabase.from("banners").update(payload).eq("id", data.id).select("*").maybeSingle()
      : await context.supabase.from("banners").insert(payload).select("*").maybeSingle();
    if (error) throw error;
    if (!row) throw new Error("Falha ao salvar banner");
    return toDTO(context.supabase, row);
  });

export const deleteBanner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => {
    if (!d.id) throw new Error("id obrigatório");
    return d;
  })
  .handler(async ({ data, context }) => {
    // Pega registro pra saber se tem arquivo no bucket
    const { data: row } = await context.supabase.from("banners").select("image_url").eq("id", data.id).maybeSingle();
    if (row?.image_url?.startsWith("bucket://")) {
      const path = row.image_url.replace(/^bucket:\/\//, "");
      await context.supabase.storage.from("banners").remove([path]);
    }
    const { error } = await context.supabase.from("banners").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const uploadBannerImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { filename: string; contentType: string; base64: string }) => {
    if (!d.filename || !d.contentType || !d.base64) throw new Error("Dados incompletos");
    return d;
  })
  .handler(async ({ data, context }) => {
    const bytes = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));
    const safeName = data.filename.replace(/[^a-z0-9._-]/gi, "_");
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
    const { error } = await context.supabase.storage.from("banners").upload(path, bytes, {
      contentType: data.contentType,
      upsert: false,
    });
    if (error) throw error;
    const { data: signed } = await context.supabase.storage
      .from("banners")
      .createSignedUrl(path, 60 * 60 * 24 * 7);
    return {
      storage_ref: `bucket://${path}`,
      preview_url: signed?.signedUrl ?? "",
    };
  });
