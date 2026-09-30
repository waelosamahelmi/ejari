"use client";
import { useMemo, useRef, useState } from "react";
import { Camera, Plus, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { SegmentedControl } from "@/components/ui/segmented";
import { Chip, ChipScroller } from "@/components/ui/chip";
import { DatePicker } from "@/components/ui/date-picker";
import { BeneficiarySheet } from "@/components/domain/beneficiary-sheet";
import { useMoney } from "@/components/shell/prefs-context";
import { useAction } from "@/hooks/use-action";
import { saveVoucher, type VoucherInput } from "@/server/actions/expenses";
import { uploadAttachment } from "@/server/actions/files";
import { allocateExpenseLine, ALLOCATION_MODES, type AllocationMode } from "@/domain/expenses";
import { tafqeetKWD, wordsEN } from "@/domain/tafqeet";
import { todayKuwait } from "@/domain/dates";
import { cn } from "@/lib/utils";

interface PropertyOpt {
  id: string;
  name: string;
  unitCount: number;
  expectedRentFils: number;
  units: { id: string; label: string }[];
}

type Line = VoucherInput["lines"][number];

const COLORS = [
  "var(--brand-gulf)",
  "var(--brand-sand)",
  "var(--teal)",
  "var(--indigo)",
  "var(--orange)",
  "var(--gray)",
];

function emptyLine(categoryId: string, propertyId: string): Line {
  return {
    amountFils: 0,
    categoryId,
    beneficiaryId: null,
    description: "",
    mode: "single",
    targets: propertyId ? [{ propertyId }] : [],
  };
}

export function VoucherForm({
  id,
  initial,
  categories,
  beneficiaries: initialBeneficiaries,
  properties,
}: {
  id: string | null;
  initial: VoucherInput | null;
  categories: { id: string; nameAr: string; nameEn: string }[];
  beneficiaries: { id: string; name: string }[];
  properties: PropertyOpt[];
}) {
  const t = useTranslations("expenses.form");
  const tMode = useTranslations("enums.allocationMode");
  const tFrom = useTranslations("enums.paidFrom");
  const locale = useLocale() as "ar" | "en";
  const money = useMoney();
  const router = useRouter();
  const { exec, pending } = useAction();
  const [beneficiaries, setBeneficiaries] = useState(initialBeneficiaries);
  const [benSheetFor, setBenSheetFor] = useState<number | null>(null);
  const [v, setV] = useState<VoucherInput>(
    initial ?? {
      voucherNo: "",
      voucherDate: todayKuwait(),
      paidFrom: "cash_box",
      reference: "",
      recipientName: "",
      notes: "",
      lines: [emptyLine(categories[0]?.id ?? "", properties[0]?.id ?? "")],
    },
  );
  const [files, setFiles] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const setLine = (i: number, patch: Partial<Line>) =>
    setV((s) => ({ ...s, lines: s.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) }));
  const total = v.lines.reduce((a, l) => a + (l.amountFils || 0), 0);

  const previews = useMemo(
    () =>
      v.lines.map((l) => {
        try {
          if (!l.amountFils || !l.targets.length) return null;
          return allocateExpenseLine(
            l.amountFils,
            l.mode,
            l.targets.map((tg) => {
              const p = properties.find((x) => x.id === tg.propertyId);
              return {
                ...tg,
                unitCount: p?.unitCount ?? 0,
                expectedRentFils: p?.expectedRentFils ?? 0,
              };
            }),
          );
        } catch {
          return "error" as const;
        }
      }),
    [v.lines, properties],
  );

  const changeMode = (i: number, mode: AllocationMode) => {
    const l = v.lines[i]!;
    let targets = l.targets;
    if (mode === "single")
      targets = targets
        .slice(0, 1)
        .map((x) => ({ propertyId: x.propertyId, unitId: x.unitId ?? null }));
    else if (mode === "manual_percent")
      targets = targets.map((x, _, arr) => ({
        propertyId: x.propertyId,
        percent: Math.round((100 / arr.length) * 100) / 100,
      }));
    else if (mode === "manual_amount")
      targets = targets.map((x, _, arr) => ({
        propertyId: x.propertyId,
        amountFils: Math.floor((l.amountFils || 0) / arr.length),
      }));
    else targets = targets.map((x) => ({ propertyId: x.propertyId }));
    setLine(i, { mode, targets });
  };

  const toggleProperty = (i: number, pid: string) => {
    const l = v.lines[i]!;
    if (l.mode === "single") return setLine(i, { targets: [{ propertyId: pid, unitId: null }] });
    const has = l.targets.some((x) => x.propertyId === pid);
    setLine(i, {
      targets: has
        ? l.targets.filter((x) => x.propertyId !== pid)
        : [...l.targets, { propertyId: pid, percent: 0, amountFils: 0 }],
    });
  };

  const submit = async (post: boolean) => {
    const r = await exec(
      () =>
        saveVoucher(
          id,
          { ...v, lines: v.lines.map((l) => ({ ...l, beneficiaryId: l.beneficiaryId || null })) },
          post,
        ),
      { success: post ? t("posted") : t("saved") },
    );
    if (!r.ok) return;
    for (const f of files) {
      const fd = new FormData();
      fd.set("file", f);
      await uploadAttachment("voucher", r.data, fd, "vouchers");
    }
    router.push(`/expenses/${r.data}`);
    router.refresh();
  };

  return (
    <div className="space-y-5">
      <Card className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
        <Field label={t("voucherNo")} htmlFor="v-no" hint={t("voucherNoHint")}>
          <Input
            id="v-no"
            dir="ltr"
            className="num"
            value={v.voucherNo ?? ""}
            onChange={(e) => setV({ ...v, voucherNo: e.target.value })}
          />
        </Field>
        <Field label={t("date")} htmlFor="v-date">
          <DatePicker
            id="v-date"
            value={v.voucherDate}
            onChange={(d) => d && setV({ ...v, voucherDate: d })}
          />
        </Field>
        <Field label={t("paidFrom")} className="sm:col-span-2">
          <SegmentedControl
            options={(["cash_box", "bank", "cheque"] as const).map((k) => ({
              value: k,
              label: tFrom(k),
            }))}
            value={v.paidFrom}
            onChange={(k) => setV({ ...v, paidFrom: k })}
          />
        </Field>
        <Field label={t("recipient")} htmlFor="v-rec" className="sm:col-span-2">
          <Input
            id="v-rec"
            value={v.recipientName ?? ""}
            onChange={(e) => setV({ ...v, recipientName: e.target.value })}
          />
        </Field>
        <Field label={t("reference")} htmlFor="v-ref" className="sm:col-span-2">
          <Input
            id="v-ref"
            dir="ltr"
            value={v.reference ?? ""}
            onChange={(e) => setV({ ...v, reference: e.target.value })}
          />
        </Field>
      </Card>

      <div className="space-y-4">
        {v.lines.map((l, i) => {
          const pv = previews[i];
          return (
            <Card key={i} className="space-y-4 p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-[17px] font-semibold">{t("line", { n: i + 1 })}</h3>
                {v.lines.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("removeLine")}
                    onClick={() => setV({ ...v, lines: v.lines.filter((_, j) => j !== i) })}
                  >
                    <Trash2 />
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label={t("amount")} htmlFor={`l-amt-${i}`}>
                  <MoneyInput
                    id={`l-amt-${i}`}
                    value={l.amountFils || null}
                    onChange={(f) => setLine(i, { amountFils: f ?? 0 })}
                  />
                </Field>
                <Field label={t("category")} htmlFor={`l-cat-${i}`}>
                  <Select
                    id={`l-cat-${i}`}
                    value={l.categoryId}
                    onChange={(e) => setLine(i, { categoryId: e.target.value })}
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {locale === "ar" ? c.nameAr : c.nameEn}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field
                  label={t("beneficiary")}
                  htmlFor={`l-ben-${i}`}
                  trailing={
                    <button
                      type="button"
                      className="text-link text-[13px]"
                      onClick={() => setBenSheetFor(i)}
                    >
                      {t("newBeneficiary")}
                    </button>
                  }
                >
                  <Select
                    id={`l-ben-${i}`}
                    value={l.beneficiaryId ?? ""}
                    onChange={(e) => setLine(i, { beneficiaryId: e.target.value || null })}
                  >
                    <option value="">—</option>
                    {beneficiaries.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={t("description")} htmlFor={`l-desc-${i}`}>
                  <Input
                    id={`l-desc-${i}`}
                    value={l.description}
                    onChange={(e) => setLine(i, { description: e.target.value })}
                  />
                </Field>
              </div>
              <Field label={t("allocation")}>
                <div className="space-y-3">
                  <ChipScroller>
                    {ALLOCATION_MODES.map((m) => (
                      <Chip key={m} active={l.mode === m} onClick={() => changeMode(i, m)}>
                        {tMode(m)}
                      </Chip>
                    ))}
                  </ChipScroller>
                  <ChipScroller>
                    {properties.map((p) => (
                      <Chip
                        key={p.id}
                        active={l.targets.some((x) => x.propertyId === p.id)}
                        onClick={() => toggleProperty(i, p.id)}
                      >
                        {p.name}
                      </Chip>
                    ))}
                  </ChipScroller>
                  {l.mode === "single" && l.targets[0] && (
                    <Select
                      aria-label={t("unit")}
                      value={l.targets[0].unitId ?? ""}
                      onChange={(e) =>
                        setLine(i, {
                          targets: [
                            {
                              propertyId: l.targets[0]!.propertyId,
                              unitId: e.target.value || null,
                            },
                          ],
                        })
                      }
                    >
                      <option value="">{t("noUnit")}</option>
                      {properties
                        .find((p) => p.id === l.targets[0]!.propertyId)
                        ?.units.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.label}
                          </option>
                        ))}
                    </Select>
                  )}
                  {(l.mode === "manual_percent" || l.mode === "manual_amount") && (
                    <div className="space-y-2">
                      {l.targets.map((tg, k) => (
                        <div key={tg.propertyId} className="flex items-center gap-3">
                          <span className="flex-1 text-[15px]">
                            {properties.find((p) => p.id === tg.propertyId)?.name}
                          </span>
                          {l.mode === "manual_percent" ? (
                            <Input
                              aria-label={t("percent")}
                              inputMode="decimal"
                              className="num w-28 text-center"
                              value={tg.percent ?? 0}
                              onChange={(e) =>
                                setLine(i, {
                                  targets: l.targets.map((x, j) =>
                                    j === k ? { ...x, percent: Number(e.target.value) || 0 } : x,
                                  ),
                                })
                              }
                            />
                          ) : (
                            <div className="w-44">
                              <MoneyInput
                                value={tg.amountFils ?? 0}
                                onChange={(f) =>
                                  setLine(i, {
                                    targets: l.targets.map((x, j) =>
                                      j === k ? { ...x, amountFils: f ?? 0 } : x,
                                    ),
                                  })
                                }
                                showWords={false}
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {pv === "error" ? (
                    <p className="text-red-text text-[13px]">{t("sumMismatch")}</p>
                  ) : pv && pv.length > 0 ? (
                    <div className="space-y-2" aria-label={t("preview")}>
                      <div className="flex h-3 overflow-hidden rounded-full">
                        {pv.map((a, k) => (
                          <div
                            key={a.propertyId}
                            style={{
                              width: `${(a.amountFils / Math.max(1, l.amountFils)) * 100}%`,
                              background: COLORS[k % COLORS.length],
                            }}
                          />
                        ))}
                      </div>
                      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-[13px]">
                        {pv.map((a, k) => (
                          <li key={a.propertyId} className="flex items-center gap-1.5">
                            <span
                              className="size-2 rounded-full"
                              style={{ background: COLORS[k % COLORS.length] }}
                            />
                            {properties.find((p) => p.id === a.propertyId)?.name}
                            <span className="num text-label-2">{money(a.amountFils)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              </Field>
            </Card>
          );
        })}
        <Button
          variant="secondary"
          onClick={() =>
            setV({
              ...v,
              lines: [...v.lines, emptyLine(categories[0]?.id ?? "", properties[0]?.id ?? "")],
            })
          }
        >
          <Plus />
          {t("addLine")}
        </Button>
      </div>

      <Card className="space-y-3 p-5">
        <Field label={t("notes")} htmlFor="v-notes">
          <Textarea
            id="v-notes"
            rows={2}
            value={v.notes ?? ""}
            onChange={(e) => setV({ ...v, notes: e.target.value })}
          />
        </Field>
        <div>
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            <Camera />
            {files.length ? files.map((f) => f.name).join(", ") : t("attachments")}
          </Button>
          <input
            ref={fileRef}
            type="file"
            hidden
            multiple
            accept="image/*,application/pdf"
            capture="environment"
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          />
        </div>
      </Card>

      <div className="material-bar border-separator sticky bottom-[calc(84px+var(--safe-bottom))] z-20 flex flex-wrap items-center justify-between gap-3 rounded-[24px] border p-4 lg:bottom-4">
        <div className="min-w-0">
          <div className="text-label-2 text-[12px]">{t("total")}</div>
          <div className="num text-[24px] font-semibold">{money(total)}</div>
          {total > 0 && (
            <div className={cn("text-label-2 truncate text-[13px]")}>
              {locale === "ar" ? tafqeetKWD(total) : wordsEN(total)}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => submit(false)} loading={pending}>
            {t("saveDraft")}
          </Button>
          <Button
            onClick={() => submit(true)}
            loading={pending}
            disabled={total <= 0 || previews.some((p) => p === "error" || p === null)}
          >
            {t("post")}
          </Button>
        </div>
      </div>

      <BeneficiarySheet
        open={benSheetFor !== null}
        onOpenChange={(o) => !o && setBenSheetFor(null)}
        row={null}
        onSaved={(b) => {
          setBeneficiaries((bs) => [...bs, b]);
          if (benSheetFor !== null) setLine(benSheetFor, { beneficiaryId: b.id });
          toast.success(b.name);
        }}
      />
    </div>
  );
}
