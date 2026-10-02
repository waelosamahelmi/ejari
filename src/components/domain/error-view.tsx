"use client";
import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { NoResultsIllustration, OfflineIllustration } from "@/components/illustrations";
import { Link } from "@/i18n/navigation";
import { reportError } from "@/lib/monitoring";
import { cn } from "@/lib/utils";

/** Branded error / not-found state used by every segment's boundary, in the current language. */
export function ErrorView({
  kind,
  error,
  reset,
  fullPage,
}: {
  kind: "error" | "notFound";
  error?: Error & { digest?: string };
  reset?: () => void;
  fullPage?: boolean;
}) {
  const t = useTranslations("errors.page");
  const tc = useTranslations("common.actions");
  useEffect(() => {
    if (error) reportError(error);
  }, [error]);
  return (
    <div
      className={cn(
        "grid place-items-center",
        fullPage ? "bg-mist min-h-dvh px-4" : "min-h-[60vh]",
      )}
    >
      <EmptyState
        illustration={kind === "notFound" ? <NoResultsIllustration /> : <OfflineIllustration />}
        title={kind === "notFound" ? t("notFoundTitle") : t("title")}
        description={
          <>
            {kind === "notFound" ? t("notFoundSubtitle") : t("subtitle")}
            {error?.digest && (
              <span className="num text-label-2 mt-1 block text-[12px]" dir="ltr">
                {error.digest}
              </span>
            )}
          </>
        }
        action={
          <div className="flex flex-wrap justify-center gap-2">
            {reset && <Button onClick={reset}>{tc("retry")}</Button>}
            <Button asChild variant={reset ? "secondary" : "primary"}>
              <Link href="/">{t("home")}</Link>
            </Button>
          </div>
        }
      />
    </div>
  );
}
