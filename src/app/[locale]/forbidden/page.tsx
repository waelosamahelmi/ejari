import { getTranslations } from "next-intl/server";
import { AuthCard } from "@/components/domain/auth-card";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { pageLocale, type LocaleParams } from "@/lib/i18n";

export default async function ForbiddenPage({ params }: LocaleParams) {
  await pageLocale(params);
  const t = await getTranslations("auth.forbidden");
  return (
    <AuthCard title={t("title")} subtitle={t("subtitle")}>
      <Button asChild size="lg" block>
        <Link href="/">{t("home")}</Link>
      </Button>
    </AuthCard>
  );
}
