import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { supabaseServer } from "@/lib/supabase/server";
import { requirePrintContext } from "@/server/print";
import { loadPrintableContract } from "@/server/queries/contracts";
import { ContractDocument } from "@/components/print/contract-document";
import { PrintToolbar } from "@/components/print/print-toolbar";

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { id } = await params;
  const { lang } = await searchParams;
  const t = await getTranslations({
    locale: lang === "en" ? "en" : "ar",
    namespace: "documents.printTitles",
  });
  // The browser uses the page title as the suggested name when saving to PDF.
  const doc = await loadPrintableContract(await supabaseServer(), id).catch(() => null);
  return { title: doc?.fileName ?? t("contract") };
}

export default async function PrintContract({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lang?: string; auto?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { lang } = await requirePrintContext(sp.lang);
  const t = await getTranslations({ locale: lang, namespace: "common.actions" });
  const db = await supabaseServer();
  const doc = await loadPrintableContract(db, id);
  if (!doc?.rendered) notFound();
  const { rendered, parties } = doc;
  return (
    <>
      <PrintToolbar
        auto={sp.auto === "1"}
        lang="ar"
        labels={{ print: t("print"), close: t("close") }}
      />
      <div className="print-page">
        <ContractDocument
          rendered={rendered}
          ownerName={parties.owner.name}
          tenantName={parties.tenant.name}
          coTenantNames={parties.coTenants.map((t) => t.name)}
        />
      </div>
    </>
  );
}
