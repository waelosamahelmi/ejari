"use server";
import { revalidatePath } from "next/cache";
import sharp from "sharp";
import { supabaseServer } from "@/lib/supabase/server";
import { requireActionContext, ActionError } from "@/lib/auth";
import { run } from "@/server/action";
import { signPaths, type Bucket } from "@/server/storage";

const MAX_BYTES = 15 * 1024 * 1024;
const DOC_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
];

function safeName(name: string) {
  const ext = name.includes(".")
    ? name
        .slice(name.lastIndexOf("."))
        .toLowerCase()
        .replace(/[^.a-z0-9]/g, "")
    : "";
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}${ext}`;
}

/** Photo upload for properties/units: resized variant + blur placeholder, stored in the private `media` bucket. */
export async function uploadPhoto(entity: "property" | "unit", id: string, form: FormData) {
  return run(async () => {
    const ctx = await requireActionContext("manage_master_data");
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) throw new ActionError("validation");
    if (file.size > MAX_BYTES || !file.type.startsWith("image/"))
      throw new ActionError("validation");
    const buf = Buffer.from(await file.arrayBuffer());
    const img = sharp(buf).rotate();
    const main = await img
      .clone()
      .resize({ width: 2000, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
    const meta = await sharp(main).metadata();
    const tiny = await img
      .clone()
      .resize(16, 12, { fit: "cover" })
      .blur(1)
      .jpeg({ quality: 50 })
      .toBuffer();
    const path = `${ctx.orgId}/${entity}/${id}/${safeName("photo.webp")}`;
    const db = await supabaseServer();
    const up = await db.storage.from("media").upload(path, main, { contentType: "image/webp" });
    if (up.error) throw up.error;
    const table = entity === "property" ? "properties" : "units";
    const { data: row } = await db.from(table).select("photos").eq("id", id).single();
    const photos = [
      ...((row?.photos as { path: string }[] | null) ?? []),
      {
        path,
        blur: `data:image/jpeg;base64,${tiny.toString("base64")}`,
        w: meta.width,
        h: meta.height,
      },
    ];
    const { error } =
      entity === "property"
        ? await db
            .from("properties")
            .update({ photos, cover_image_path: photos[0]!.path })
            .eq("id", id)
        : await db.from("units").update({ photos }).eq("id", id);
    if (error) throw error;
    revalidatePath("/[locale]", "layout");
  });
}

export async function reorderPhotos(entity: "property" | "unit", id: string, paths: string[]) {
  return run(async () => {
    await requireActionContext("manage_master_data");
    const db = await supabaseServer();
    const table = entity === "property" ? "properties" : "units";
    const { data: row } = await db.from(table).select("photos").eq("id", id).single();
    const current = (row?.photos as { path: string }[] | null) ?? [];
    const next = paths
      .map((p) => current.find((c) => c.path === p))
      .filter((x): x is { path: string } => !!x);
    const removed = current
      .filter((c) => !paths.includes(c.path))
      .map((c) => c.path)
      .filter((p) => !p.startsWith("/"));
    if (removed.length) await db.storage.from("media").remove(removed);
    const { error } =
      entity === "property"
        ? await db
            .from("properties")
            .update({ photos: next, cover_image_path: next[0]?.path ?? null })
            .eq("id", id)
        : await db.from("units").update({ photos: next }).eq("id", id);
    if (error) throw error;
    revalidatePath("/[locale]", "layout");
  });
}

export interface AttachmentView {
  id: string;
  fileName: string;
  mime: string | null;
  size: number | null;
  createdAt: string;
  url: string | null;
}

export async function listAttachments(
  entityType: string,
  entityId: string,
): Promise<AttachmentView[]> {
  await requireActionContext();
  const db = await supabaseServer();
  const { data } = await db
    .from("attachments")
    .select("id, bucket, path, file_name, mime, size, created_at")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false });
  const rows = data ?? [];
  const byBucket = new Map<string, string[]>();
  for (const r of rows) byBucket.set(r.bucket, [...(byBucket.get(r.bucket) ?? []), r.path]);
  const signed = new Map<string, string>();
  for (const [b, paths] of byBucket)
    for (const [k, v] of await signPaths(b as Bucket, paths)) signed.set(k, v);
  return rows.map((r) => ({
    id: r.id,
    fileName: r.file_name,
    mime: r.mime,
    size: r.size,
    createdAt: r.created_at,
    url: signed.get(r.path) ?? null,
  }));
}

/** Upload a document (civil ID copy, license, invoice photo, signed scan…) and link it to an entity. */
export async function uploadAttachment(
  entityType: string,
  entityId: string,
  form: FormData,
  bucket: Bucket = "documents",
) {
  return run(async () => {
    const ctx = await requireActionContext();
    if (ctx.role === "viewer" || ctx.role === "owner") throw new ActionError("forbidden");
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0 || file.size > MAX_BYTES)
      throw new ActionError("validation");
    if (!DOC_TYPES.includes(file.type)) throw new ActionError("validation");
    const path = `${ctx.orgId}/${entityType}/${entityId}/${safeName(file.name)}`;
    const db = await supabaseServer();
    const up = await db.storage.from(bucket).upload(path, file, { contentType: file.type });
    if (up.error) throw up.error;
    const { data, error } = await db
      .from("attachments")
      .insert({
        org_id: ctx.orgId,
        entity_type: entityType,
        entity_id: entityId,
        bucket,
        path,
        file_name: file.name,
        mime: file.type,
        size: file.size,
      })
      .select("id")
      .single();
    if (error) throw error;
    return { id: data.id, path };
  });
}

export async function deleteAttachment(id: string) {
  return run(async () => {
    await requireActionContext("manage_master_data");
    const db = await supabaseServer();
    const { data } = await db.from("attachments").select("bucket, path").eq("id", id).single();
    if (data) await db.storage.from(data.bucket).remove([data.path]);
    const { error } = await db.from("attachments").delete().eq("id", id);
    if (error) throw error;
  });
}
