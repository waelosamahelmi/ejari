import "server-only";
import { supabaseServer } from "@/lib/supabase/server";

export const SIGNED_URL_TTL = 300; // 5 minutes (§12)

export type Bucket = "contracts" | "receipts" | "vouchers" | "documents" | "branding" | "media";

/** Signs many storage paths at once. Brand photos (/brand/…) pass through unchanged. */
export async function signPaths(
  bucket: Bucket,
  paths: (string | null | undefined)[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const toSign = [
    ...new Set(
      paths.filter((p): p is string => !!p && !p.startsWith("/") && !p.startsWith("http")),
    ),
  ];
  for (const p of paths) if (p && (p.startsWith("/") || p.startsWith("http"))) out.set(p, p);
  if (toSign.length === 0) return out;
  const db = await supabaseServer();
  const { data } = await db.storage.from(bucket).createSignedUrls(toSign, SIGNED_URL_TTL);
  for (const d of data ?? []) if (d.signedUrl && d.path) out.set(d.path, d.signedUrl);
  return out;
}

export async function signPath(
  bucket: Bucket,
  path: string | null | undefined,
): Promise<string | null> {
  if (!path) return null;
  return (await signPaths(bucket, [path])).get(path) ?? null;
}
