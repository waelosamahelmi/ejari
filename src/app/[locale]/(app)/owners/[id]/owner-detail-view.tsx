"use client";
import dynamic from "next/dynamic";
import { useState } from "react";
import { Building2, Landmark, Mail, Pencil, Phone } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LargeTitleHeader } from "@/components/shell/large-title-header";
import { Button } from "@/components/ui/button";
import { GroupedList, GroupedSection, ListRow } from "@/components/ui/grouped-list";
import { IconTile } from "@/components/ui/icon-tile";
import { Documents } from "@/components/domain/documents";
import { formatPhone } from "@/domain/validation";

// Sheets are code-split: they load after hydration instead of with the page.
const OwnerFormSheet = dynamic(
  () => import("@/components/domain/owners/owner-form").then((m) => m.OwnerFormSheet),
  { ssr: false },
);

export interface OwnerDetail {
  id: string;
  fullName: string;
  civilId: string;
  phones: string[];
  email: string;
  iban: string;
  bankName: string;
  address: string;
  notes: string;
  portalLinked: boolean;
  properties: { id: string; name: string; area: string | null; share: number }[];
}

export function OwnerDetailView({
  owner: o,
  canEdit,
  portalSlot,
}: {
  owner: OwnerDetail;
  canEdit: boolean;
  portalSlot?: React.ReactNode;
}) {
  const t = useTranslations("owners");
  const tDocs = useTranslations("documents");
  const [editing, setEditing] = useState(false);
  return (
    <>
      <LargeTitleHeader
        title={o.fullName}
        back={{ href: "/owners", label: t("title") }}
        actions={
          canEdit ? (
            <Button
              variant="secondary"
              size="icon"
              aria-label={t("edit")}
              onClick={() => setEditing(true)}
            >
              <Pencil />
            </Button>
          ) : undefined
        }
      />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <GroupedList>
          <GroupedSection header={t("sections.properties")}>
            {o.properties.map((p) => (
              <ListRow
                key={p.id}
                LinkComponent={Link}
                href={`/properties/${p.id}`}
                leading={
                  <IconTile tone="gulf">
                    <Building2 />
                  </IconTile>
                }
                title={p.name}
                subtitle={p.area ?? undefined}
                trailing={<span className="num">{t("share", { pct: p.share })}</span>}
                chevron
              />
            ))}
          </GroupedSection>
          <GroupedSection header={t("sections.contact")}>
            {o.civilId && (
              <ListRow
                title={t("fields.civilId")}
                trailing={<span className="num">{o.civilId}</span>}
              />
            )}
            {o.phones.map((p) => (
              <ListRow
                key={p}
                leading={
                  <IconTile tone="green">
                    <Phone />
                  </IconTile>
                }
                title={
                  <a className="num" dir="ltr" href={`tel:+965${p}`}>
                    {formatPhone(p)}
                  </a>
                }
              />
            ))}
            {o.email && (
              <ListRow
                leading={
                  <IconTile tone="gulf">
                    <Mail />
                  </IconTile>
                }
                title={o.email}
              />
            )}
            {o.address && <ListRow title={t("fields.address")} subtitle={o.address} />}
          </GroupedSection>
          <GroupedSection header={t("sections.bank")}>
            <ListRow
              leading={
                <IconTile tone="sand">
                  <Landmark />
                </IconTile>
              }
              title={o.bankName || "—"}
              subtitle={
                <span className="num" dir="ltr">
                  {o.iban || "—"}
                </span>
              }
            />
          </GroupedSection>
        </GroupedList>
        <div className="space-y-5">
          {portalSlot}
          <section>
            <h3 className="text-label-2 px-5 pb-2 text-[13px] font-medium">{tDocs("title")}</h3>
            <Documents entityType="owner" entityId={o.id} canEdit={canEdit} canDelete={canEdit} />
          </section>
        </div>
      </div>
      <OwnerFormSheet
        open={editing}
        onOpenChange={setEditing}
        owner={{
          id: o.id,
          fullName: o.fullName,
          civilId: o.civilId,
          phones: o.phones,
          email: o.email,
          iban: o.iban,
          bankName: o.bankName,
          address: o.address,
          notes: o.notes,
        }}
      />
    </>
  );
}
