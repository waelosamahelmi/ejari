"use client";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { findClearance, issueClearance } from "@/server/actions/clearances";
import { useAction } from "@/hooks/use-action";
export function ClearanceActions({
  contractId,
  canIssue,
}: {
  contractId: string;
  canIssue: boolean;
}) {
  const t = useTranslations("contracts.clearance");
  const locale = useLocale();
  const [id, setId] = useState<string | null>(null);
  const { exec, pending } = useAction();
  useEffect(() => {
    void findClearance(contractId).then((r) => {
      if (r.ok) setId(r.data);
    });
  }, [contractId]);
  return (
    <div className="border-separator my-4 rounded-2xl border p-4">
      <p className="mb-3 text-sm">{t("help")}</p>
      {id ? (
        <a
          className="text-link font-medium"
          target="_blank"
          rel="noreferrer"
          href={`/print/clearance/${id}?lang=${locale}`}
        >
          {t("print")}
        </a>
      ) : canIssue ? (
        <Button
          loading={pending}
          variant="secondary"
          onClick={() => exec(() => issueClearance(contractId), { onSuccess: setId })}
        >
          {t("create")}
        </Button>
      ) : null}
    </div>
  );
}
