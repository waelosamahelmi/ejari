"use client";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { LargeTitleHeader } from "@/components/shell/large-title-header";
import { SearchField } from "@/components/ui/search-field";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { NoTenantsIllustration } from "@/components/illustrations";
import { OwnerFormSheet } from "@/components/domain/owners/owner-form";
import { initials } from "@/lib/utils";

interface Row { id: string; name: string; civilId: string; phone: string | null; portal: boolean; properties: { name: string; share: number }[] }

export function OwnersView({ rows, canEdit }: { rows: Row[]; canEdit: boolean }) {
  const t = useTranslations("owners");
  const router = useRouter();
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const filtered = useMemo(() => rows.filter((r) => !q || r.name.includes(q) || r.properties.some((p) => p.name.includes(q))), [rows, q]);
  return (
    <>
      <LargeTitleHeader title={t("title")} actions={canEdit ? <Button onClick={() => setCreating(true)}><Plus />{t("new")}</Button> : undefined}>
        <SearchField value={q} onValueChange={setQ} placeholder={t("search")} />
      </LargeTitleHeader>
      {rows.length === 0 ? (
        <EmptyState illustration={<NoTenantsIllustration />} title={t("empty")} description={t("emptyText")} action={canEdit ? <Button size="lg" onClick={() => setCreating(true)}><Plus />{t("new")}</Button> : undefined} />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((o) => (
            <li key={o.id}>
              <Link href={`/owners/${o.id}`} className="card press flex items-start gap-4 p-5">
                <span className="bg-rose/15 text-rose flex size-12 shrink-0 items-center justify-center rounded-full text-[16px] font-semibold">{initials(o.name)}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[17px] font-semibold">{o.name}</div>
                  <div className="text-label-2 num text-[13px]">{[o.civilId, o.phone].filter(Boolean).join(" · ")}</div>
                  <div className="text-label-2 mt-2 text-[14px]">{t("propertiesCount", { count: o.properties.length })}</div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {o.properties.map((p) => (
                      <span key={p.name} className="bg-inset rounded-full px-2.5 py-0.5 text-[12px]">{p.name}{p.share < 100 ? ` · ${p.share}٪` : ""}</span>
                    ))}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <OwnerFormSheet open={creating} onOpenChange={setCreating} onSaved={(id) => router.push(`/owners/${id}`)} />
    </>
  );
}
