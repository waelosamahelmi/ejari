import { getTranslations } from "next-intl/server";
import { requireContext } from "@/lib/auth";
import { pageLocale, type LocaleParams } from "@/lib/i18n";
import { voucherFormOptions } from "@/server/queries/expenses";
import { LargeTitleHeader } from "@/components/shell/large-title-header";
import { VoucherForm } from "@/components/domain/expenses/voucher-form";

export default async function NewVoucherPage({ params }: LocaleParams) {
  const { locale } = await pageLocale(params);
  const ctx = await requireContext(locale, { capability: "manage_expenses" });
  const t = await getTranslations("expenses");
  const opts = await voucherFormOptions(ctx);
  return (
    <>
      <LargeTitleHeader title={t("new")} back={{ href: "/expenses", label: t("title") }} />
      <VoucherForm id={null} initial={null} {...opts} />
    </>
  );
}
