"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import sharp from "sharp";
import { supabaseServer } from "@/lib/supabase/server";
import { requireActionContext, ActionError, parseSettings, type OrgSettings } from "@/lib/auth";
import { run } from "@/server/action";
import { isValidCondition, isValidTemplateText } from "@/domain/templates";

const reval = () => revalidatePath("/[locale]", "layout");

export async function saveOrgProfile(input: { name: string; nameEn: string | null }) {
  return run(async () => {
    const ctx = await requireActionContext("manage_org");
    const d = z
      .object({
        name: z.string().trim().min(2).max(120),
        nameEn: z.string().trim().max(120).nullable(),
      })
      .parse(input);
    const db = await supabaseServer();
    const { error } = await db
      .from("orgs")
      .update({ name: d.name, name_en: d.nameEn || null })
      .eq("id", ctx.orgId);
    if (error) throw error;
    reval();
  });
}

const settingsPatch = z.object({
  proration: z.boolean().optional(),
  dueDay: z.number().int().min(1).max(28).optional(),
  receiptDuplicatePolicy: z.enum(["warn", "block"]).optional(),
  letterhead: z.boolean().optional(),
  poweredBy: z.boolean().optional(),
  accent: z.string().max(20).optional(),
  digits: z.enum(["latn", "arab"]).optional(),
  voucherThresholdFils: z.number().int().min(0).optional(),
  lateReminderDays: z.array(z.number().int().min(1).max(365)).max(8).optional(),
  numbering: z
    .object({
      contractResidential: z.string().regex(/^[A-Z]{1,4}$/),
      contractInvestment: z.string().regex(/^[A-Z]{1,4}$/),
      receipt: z.string().regex(/^[A-Z]{1,4}$/),
      voucher: z.string().regex(/^[A-Z]{1,4}$/),
    })
    .optional(),
  reminderTemplateAr: z.string().max(1000).optional(),
  reminderTemplateEn: z.string().max(1000).optional(),
});

/** Patches org settings (billing rules, numbering, reminder template, print options). Org-wide options are admin-only. */
export async function saveOrgSettings(patch: z.input<typeof settingsPatch>) {
  return run(async () => {
    const d = settingsPatch.parse(patch);
    const orgOnly =
      d.letterhead !== undefined ||
      d.poweredBy !== undefined ||
      d.accent !== undefined ||
      d.numbering !== undefined;
    const ctx = await requireActionContext(orgOnly ? "manage_org" : "manage_master_data");
    const db = await supabaseServer();
    const { data: org } = await db.from("orgs").select("settings").eq("id", ctx.orgId).single();
    const next: OrgSettings = { ...parseSettings(org?.settings), ...d } as OrgSettings;
    const { error } = await db
      .from("orgs")
      .update({ settings: next as never })
      .eq("id", ctx.orgId);
    if (error) throw error;
    reval();
  });
}

export async function uploadOrgLogo(form: FormData) {
  return run(async () => {
    const ctx = await requireActionContext("manage_org");
    const file = form.get("file");
    if (!(file instanceof File) || !file.type.startsWith("image/") || file.size > 5 * 1024 * 1024)
      throw new ActionError("validation");
    const buf = await sharp(Buffer.from(await file.arrayBuffer()))
      .resize({ width: 512, height: 512, fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();
    const path = `${ctx.orgId}/logo-${Date.now().toString(36)}.png`;
    const db = await supabaseServer();
    const up = await db.storage
      .from("branding")
      .upload(path, buf, { contentType: "image/png", upsert: true });
    if (up.error) throw up.error;
    const { error } = await db.from("orgs").update({ logo_path: path }).eq("id", ctx.orgId);
    if (error) throw error;
    reval();
  });
}

const clauseSchema = z.object({
  key: z.string().regex(/^[a-z0-9_]{2,40}$/),
  body: z.string().min(1).max(4000),
  condition: z.string().max(300).nullable(),
  defaultCondition: z.string().max(300).nullable().optional(),
  optional: z.boolean(),
  defaultEnabled: z.boolean(),
});

/** Saves an edited template as a NEW version (existing contracts keep their frozen snapshot). */
export async function saveTemplateVersion(input: {
  baseId: string;
  name: string;
  preamble: string;
  closing: string | null;
  clauses: z.input<typeof clauseSchema>[];
}) {
  return run(async () => {
    const ctx = await requireActionContext("manage_templates");
    const clauses = z.array(clauseSchema).min(1).parse(input.clauses);
    if (
      !isValidTemplateText(input.preamble) ||
      clauses.some(
        (c) => !isValidTemplateText(c.body) || (c.condition && !isValidCondition(c.condition)),
      )
    )
      throw new ActionError("validation");
    if (new Set(clauses.map((c) => c.key)).size !== clauses.length)
      throw new ActionError("duplicate");
    const db = await supabaseServer();
    const { data: base } = await db
      .from("contract_templates")
      .select("type, family_id, version, org_id")
      .eq("id", input.baseId)
      .single();
    if (!base) throw new ActionError("notFound");
    const { data: fam } = await db
      .from("contract_templates")
      .select("version")
      .eq("family_id", base.family_id)
      .order("version", { ascending: false })
      .limit(1);
    const version = Math.max(base.version, fam?.[0]?.version ?? 0) + 1;
    // Only one default per type in the org.
    await db
      .from("contract_templates")
      .update({ is_default: false })
      .eq("org_id", ctx.orgId)
      .eq("type", base.type);
    const { data: tpl, error } = await db
      .from("contract_templates")
      .insert({
        org_id: ctx.orgId,
        type: base.type,
        name: input.name,
        version,
        family_id: base.family_id,
        preamble: input.preamble,
        closing: input.closing,
        is_default: true,
      })
      .select("id")
      .single();
    if (error) throw error;
    const ins = await db
      .from("template_clauses")
      .insert(
        clauses.map((c, i) => ({
          org_id: ctx.orgId,
          template_id: tpl.id,
          position: i + 1,
          key: c.key,
          body: c.body,
          condition: c.condition || null,
          default_condition: c.defaultCondition || null,
          optional: c.optional,
          default_enabled: c.defaultEnabled,
        })),
      );
    if (ins.error) throw ins.error;
    reval();
    return version;
  });
}
