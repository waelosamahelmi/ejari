"use client";
import { useState, useTransition } from "react";
import { History, Minus, PencilLine, Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { LargeTitleHeader } from "@/components/shell/large-title-header";
import { GroupedSection, ListRow } from "@/components/ui/grouped-list";
import { IconTile } from "@/components/ui/icon-tile";
import { Chip, ChipScroller } from "@/components/ui/chip";
import { Select } from "@/components/ui/input";
import { SearchField } from "@/components/ui/search-field";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { NoResultsIllustration } from "@/components/illustrations";
import { cn } from "@/lib/utils";

export interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  at: string;
  user: string | null;
}

const ENTITIES = [
  "contracts",
  "charges",
  "payments",
  "payment_allocations",
  "adjustments",
  "expense_vouchers",
  "expense_lines",
  "expense_allocations",
  "deposits",
  "legal_cases",
  "monthly_closings",
  "owners",
  "properties",
  "units",
  "tenants",
  "org_members",
] as const;
const IGNORED = new Set(["updated_at", "created_at", "org_id", "id"]);

const show = (v: unknown) =>
  v === null || v === undefined ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v);

export function diffFields(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
) {
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  return [...keys]
    .filter((k) => !IGNORED.has(k))
    .filter((k) => !before || !after || JSON.stringify(before[k]) !== JSON.stringify(after[k]))
    .sort()
    .map((k) => ({
      field: k,
      before: before ? show(before[k]) : null,
      after: after ? show(after[k]) : null,
    }));
}

export function AuditView({
  entries,
  hasMore,
  limit,
  filters,
  users,
}: {
  entries: AuditEntry[];
  hasMore: boolean;
  limit: number;
  filters: { entity: string; action: string; user: string; id: string };
  users: { id: string; name: string }[];
}) {
  const t = useTranslations("audit");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const [idQuery, setIdQuery] = useState(filters.id);
  const [open, setOpen] = useState<AuditEntry | null>(null);
  const tx = t as unknown as { (k: string): string; has(k: string): boolean };
  const entityLabel = (e: string) => (tx.has(`entities.${e}`) ? tx(`entities.${e}`) : e);
  const actionLabel = (a: string) => (tx.has(`actions.${a}`) ? tx(`actions.${a}`) : a);
  const fmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-KW-u-nu-latn" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kuwait",
  });

  const set = (patch: Partial<Record<"entity" | "action" | "user" | "id" | "limit", string>>) =>
    start(() => {
      const q = new URLSearchParams({ ...filters, ...patch });
      for (const [k, v] of [...q.entries()]) if (!v) q.delete(k);
      router.push(`${pathname}?${q.toString()}`);
    });

  const icon = (a: string) =>
    a === "insert" ? <Plus /> : a === "delete" ? <Minus /> : <PencilLine />;
  const tone = (a: string) =>
    (a === "insert" ? "green" : a === "delete" ? "red" : "orange") as "green" | "red" | "orange";

  return (
    <>
      <LargeTitleHeader title={t("title")}>
        <div className={cn("space-y-3 transition-opacity", pending && "opacity-60")}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              set({ id: idQuery.trim() });
            }}
          >
            <SearchField
              value={idQuery}
              onValueChange={setIdQuery}
              placeholder={t("search")}
              aria-label={t("search")}
              onBlur={() => idQuery !== filters.id && set({ id: idQuery.trim() })}
            />
          </form>
          <ChipScroller ariaLabel={t("what")}>
            <Chip active={!filters.entity} onClick={() => set({ entity: "" })}>
              {t("filters.all")}
            </Chip>
            {ENTITIES.map((e) => (
              <Chip key={e} active={filters.entity === e} onClick={() => set({ entity: e })}>
                {entityLabel(e)}
              </Chip>
            ))}
          </ChipScroller>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <div className="min-w-0 sm:w-44">
              <Select
                aria-label={t("what")}
                value={filters.action}
                onChange={(e) => set({ action: e.target.value })}
              >
                <option value="">
                  {t("what")}: {t("filters.all")}
                </option>
                {(["insert", "update", "delete"] as const).map((a) => (
                  <option key={a} value={a}>
                    {t(`actions.${a}`)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="min-w-0 sm:w-56">
              <Select
                aria-label={t("who")}
                value={filters.user}
                onChange={(e) => set({ user: e.target.value })}
              >
                <option value="">
                  {t("who")}: {t("filters.all")}
                </option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </div>
      </LargeTitleHeader>
      {entries.length === 0 ? (
        <EmptyState illustration={<NoResultsIllustration />} title={t("empty")} />
      ) : (
        <GroupedSection>
          {entries.map((e) => (
            <ListRow
              key={e.id}
              onClick={() => setOpen(e)}
              leading={<IconTile tone={tone(e.action)}>{icon(e.action)}</IconTile>}
              title={`${actionLabel(e.action)} · ${entityLabel(e.entityType)}`}
              subtitle={`${e.user ?? t("system")} · ${fmt.format(new Date(e.at))}`}
              trailing={
                <span className="num text-label-2 text-[12px]" dir="ltr">
                  {e.entityId?.slice(0, 8)}
                </span>
              }
              chevron
            />
          ))}
        </GroupedSection>
      )}
      {hasMore && (
        <div className="mt-4 flex justify-center">
          <Button
            variant="secondary"
            loading={pending}
            onClick={() => set({ limit: String(limit + 100) })}
          >
            <History />
            {t("loadMore")}
          </Button>
        </div>
      )}
      <Sheet
        open={!!open}
        onOpenChange={(o) => !o && setOpen(null)}
        title={open ? `${actionLabel(open.action)} · ${entityLabel(open.entityType)}` : ""}
        description={
          open ? `${open.user ?? t("system")} · ${fmt.format(new Date(open.at))}` : undefined
        }
        size="lg"
      >
        {open && (
          <div className="space-y-3">
            {open.entityId && (
              <button
                type="button"
                className="text-link num text-[13px]"
                dir="ltr"
                onClick={() => {
                  setOpen(null);
                  set({ id: open.entityId!, entity: "" });
                }}
              >
                {open.entityId}
              </button>
            )}
            <h3 className="text-label-2 text-[13px] font-semibold">{t("diff")}</h3>
            <div className="bg-paper overflow-hidden rounded-[20px]">
              <table className="w-full table-fixed text-[13px]">
                <thead className="bg-inset/60 text-label-2">
                  <tr>
                    <th scope="col" className="w-1/4 px-3 py-2 text-start font-medium">
                      {t("field")}
                    </th>
                    <th scope="col" className="px-3 py-2 text-start font-medium">
                      {t("before")}
                    </th>
                    <th scope="col" className="px-3 py-2 text-start font-medium">
                      {t("after")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {diffFields(open.before, open.after).map((d) => (
                    <tr key={d.field} className="border-separator border-t align-top">
                      <td className="num px-3 py-2 font-medium" dir="ltr">
                        {d.field}
                      </td>
                      <td
                        className={cn(
                          "num px-3 py-2 break-all",
                          d.before !== null && "bg-red/8 text-red-text",
                        )}
                      >
                        <bdi>{d.before ?? ""}</bdi>
                      </td>
                      <td
                        className={cn(
                          "num px-3 py-2 break-all",
                          d.after !== null && "bg-green/8 text-green-text",
                        )}
                      >
                        <bdi>{d.after ?? ""}</bdi>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Sheet>
    </>
  );
}
