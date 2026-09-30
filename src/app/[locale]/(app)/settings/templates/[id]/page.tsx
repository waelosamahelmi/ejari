import { notFound } from "next/navigation";
import { requireContext } from "@/lib/auth";
import { pageLocale, type LocaleParams } from "@/lib/i18n";
import { supabaseServer } from "@/lib/supabase/server";
import { loadTemplate } from "@/server/queries/contracts";
import { TemplateEditor } from "./template-editor";

export default async function TemplateEditPage({ params }: LocaleParams<{ id: string }>) {
  const { locale, id } = await pageLocale(params);
  await requireContext(locale, { capability: "manage_templates" });
  const db = await supabaseServer();
  const { data: meta } = await db
    .from("contract_templates")
    .select("type")
    .eq("id", id)
    .maybeSingle();
  if (!meta) notFound();
  const tpl = await loadTemplate(db, meta.type, id);
  return <TemplateEditor template={tpl} />;
}
