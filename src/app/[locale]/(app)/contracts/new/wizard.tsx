"use client";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, m } from "motion/react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  CheckCircle2,
  FileText,
  Home,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
  Store,
  Trash2,
  Upload,
  UserPlus,
  X,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Link, useRouter } from "@/i18n/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wizard } from "@/components/ui/wizard";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { SearchField } from "@/components/ui/search-field";
import { SegmentedControl } from "@/components/ui/segmented";
import { Chip, ChipScroller } from "@/components/ui/chip";
import { DatePicker } from "@/components/ui/date-picker";
import { MoneyInput } from "@/components/ui/money-input";
import { Toggle } from "@/components/ui/toggle";
import { Stepper } from "@/components/ui/stepper";
import { Skeleton } from "@/components/ui/skeleton";
import { LargeTitleHeader } from "@/components/shell/large-title-header";
import { BuildingStack, type StackTile } from "@/components/domain/properties/building-stack";
import { ContractDocument } from "@/components/print/contract-document";
import { useMoney } from "@/components/shell/prefs-context";
import {
  activateContract,
  previewContract,
  saveContractDraft,
  uploadSignedContract,
  type ContractPreview,
} from "@/server/actions/contracts";
import { useAction } from "@/hooks/use-action";
import {
  addMonths,
  contractEndDate,
  dayNameAr,
  dayNameEn,
  formatDate,
  formatPeriod,
} from "@/domain/dates";
import { contractDefaults, firstCollectionFor, PURPOSE_PRESETS } from "@/domain/contracts";
import { graceMonths } from "@/domain/schedule";
import { normalizeDigits } from "@/domain/money";
import type { ContractDraftInput } from "@/lib/schemas/contract";
import { cn } from "@/lib/utils";
import type { ContractType } from "@/domain/types";

// Sheets are code-split: they load after hydration instead of with the page.
const TenantFormSheet = dynamic(
  () => import("@/components/domain/tenants/tenant-form").then((m) => m.TenantFormSheet),
  { ssr: false },
);

interface PropertyOpt {
  id: string;
  name: string;
  propertyType: string;
  ownerIds: string[];
  stack: (StackTile & { contractId: string | null })[];
}
interface TenantOpt {
  id: string;
  name: string;
  civilIdMasked: string;
  civilId: string;
  phones: string[];
  blacklisted: boolean;
}
type TemplateMeta = { key: string; optional: boolean; body: string }[];

const STEPS = ["type", "parties", "units", "terms", "clauses", "review", "finish"] as const;

function defaults(today: string, type: ContractType): ContractDraftInput {
  const d = contractDefaults(type);
  return {
    type,
    ownerId: null,
    tenantId: "",
    propertyId: "",
    unitIds: [],
    contractDate: today,
    startDate: today,
    firstCollectionDate: today,
    termMonths: d.termMonths,
    autoRenew: d.autoRenew,
    renewalTermMonths: null,
    monthlyRentFils: 0,
    purpose: PURPOSE_PRESETS[type][0]!,
    utilitiesParty: "owner",
    electricityFixedFils: 0,
    freeMonths: 0,
    freeMonthsPenaltyWindowMonths: d.freeMonthsPenaltyWindowMonths,
    noticePeriodMonths: d.noticePeriodMonths,
    securityDepositFils: 0,
    annualIncrease: null,
    clauseOverrides: {},
    customClauses: [],
    notes: "",
  };
}

export function ContractWizard({
  today,
  initial,
  preset,
  properties,
  owners,
  tenants: initialTenants,
  templates,
}: {
  today: string;
  initial: (ContractDraftInput & { id?: string }) | null;
  preset: { propertyId: string | null; unitId: string | null; tenantId: string | null };
  properties: PropertyOpt[];
  owners: { id: string; name: string }[];
  tenants: TenantOpt[];
  templates: { residential: TemplateMeta; investment: TemplateMeta };
}) {
  const t = useTranslations("contracts.wizard");
  const tc = useTranslations("contracts");
  const tEnum = useTranslations("enums");
  const tu = useTranslations("ui");
  const locale = useLocale() as "ar" | "en";
  const money = useMoney();
  const router = useRouter();
  const { exec, pending } = useAction();

  const presetProperty = properties.find((p) => p.id === preset.propertyId);
  const [draftId, setDraftId] = useState<string | null>(initial?.id ?? null);
  const [step, setStep] = useState(initial ? 3 : preset.unitId ? 0 : 0);
  const [v, setV] = useState<ContractDraftInput>(() => {
    if (initial) return initial;
    const type: ContractType =
      presetProperty &&
      (presetProperty.propertyType === "investment" || presetProperty.propertyType === "industrial")
        ? "investment"
        : "residential";
    const base = defaults(today, type);
    if (presetProperty) {
      base.propertyId = presetProperty.id;
      base.ownerId = presetProperty.ownerIds[0] ?? null;
      if (preset.unitId) {
        base.unitIds = [preset.unitId];
        base.monthlyRentFils =
          presetProperty.stack.find((s) => s.id === preset.unitId)?.askingRentFils ?? 0;
      }
    }
    if (preset.tenantId) base.tenantId = preset.tenantId;
    return base;
  });
  const [ownerTouched, setOwnerTouched] = useState(!!initial);
  const [tenants, setTenants] = useState(initialTenants);
  const [tenantQuery, setTenantQuery] = useState("");
  const [tenantSheet, setTenantSheet] = useState(false);
  const [preview, setPreview] = useState<ContractPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [editingClause, setEditingClause] = useState<string | null>(null);
  const [activatedNo, setActivatedNo] = useState<string | null>(null);
  const [customPurpose, setCustomPurpose] = useState(
    () => !!initial && !PURPOSE_PRESETS[initial.type].includes(initial.purpose),
  );
  const [termCustom, setTermCustom] = useState(
    () => ![12, 24, 36, 60].includes(initial?.termMonths ?? 60),
  );
  const fileRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof ContractDraftInput>(k: K, val: ContractDraftInput[K]) =>
    setV((s) => ({ ...s, [k]: val }));
  const property = properties.find((p) => p.id === v.propertyId);
  const tenant = tenants.find((x) => x.id === v.tenantId);
  const endDate = contractEndDate(v.startDate, v.termMonths);
  const grace = graceMonths(v.startDate, v.firstCollectionDate);

  const changeType = (type: ContractType) => {
    const d = contractDefaults(type);
    setV((s) => ({
      ...s,
      type,
      autoRenew: d.autoRenew,
      noticePeriodMonths: d.noticePeriodMonths,
      purpose: PURPOSE_PRESETS[type][0]!,
      freeMonths: type === "residential" ? 0 : s.freeMonths,
      clauseOverrides: {},
    }));
    setCustomPurpose(false);
  };

  const pickProperty = (id: string) => {
    const p = properties.find((x) => x.id === id);
    setV((s) => ({
      ...s,
      propertyId: id,
      unitIds: [],
      ownerId: ownerTouched ? s.ownerId : (p?.ownerIds[0] ?? null),
    }));
  };

  const toggleUnit = (id: string) => {
    setV((s) => {
      const has = s.unitIds.includes(id);
      const unitIds = has ? s.unitIds.filter((u) => u !== id) : [...s.unitIds, id];
      const rent = unitIds.reduce(
        (a, u) => a + (property?.stack.find((x) => x.id === u)?.askingRentFils ?? 0),
        0,
      );
      return { ...s, unitIds, monthlyRentFils: rent };
    });
  };

  const unitDisabled = (u: StackTile & { contractId?: string | null }) => {
    if (u.status === "vacant") return null;
    if (u.status === "reserved") return tEnum("unitStatus.reserved");
    return t("units.occupied", { name: u.tenantName ?? "" });
  };

  const filteredTenants = useMemo(() => {
    const q = normalizeDigits(tenantQuery).trim().toLowerCase();
    if (!q) return tenants.slice(0, 8);
    return tenants
      .filter(
        (x) =>
          x.name.toLowerCase().includes(q) ||
          x.civilId.includes(q) ||
          x.phones.some((p) => p.includes(q)),
      )
      .slice(0, 12);
  }, [tenants, tenantQuery]);

  const canNext = (() => {
    switch (STEPS[step]) {
      case "parties":
        return !!v.tenantId;
      case "units":
        return !!v.propertyId && v.unitIds.length > 0;
      case "terms":
        return (
          v.monthlyRentFils > 0 &&
          v.purpose.trim().length > 0 &&
          v.firstCollectionDate >= v.startDate &&
          v.termMonths > 0
        );
      case "review":
        return true;
      default:
        return true;
    }
  })();

  // Preview for clauses/review steps (debounced on changes).
  useEffect(() => {
    if (STEPS[step] !== "clauses" && STEPS[step] !== "review") return;
    if (!v.tenantId || !v.propertyId || !v.unitIds.length || v.monthlyRentFils <= 0) return;
    setPreviewing(true);
    const h = setTimeout(async () => {
      const r = await previewContract(v, draftId);
      if (r.ok) setPreview(r.data);
      setPreviewing(false);
    }, 250);
    return () => clearTimeout(h);
  }, [step, v, draftId]);

  const saveDraft = async (silent = false) => {
    const r = await exec(() => saveContractDraft(draftId, v), {
      success: silent ? undefined : t("autosaved"),
    });
    if (r.ok) {
      setDraftId(r.data);
      const url = new URL(window.location.href);
      url.searchParams.set("draft", r.data);
      window.history.replaceState(null, "", url.toString());
    }
    return r;
  };

  const next = async () => {
    if (STEPS[step] === "terms" || STEPS[step] === "clauses") await saveDraft(true);
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const activate = async () => {
    const saved = await saveDraft(true);
    if (!saved.ok) return;
    const r = await exec(() => activateContract(saved.data));
    if (r.ok) {
      setActivatedNo(r.data);
      toast.success(t("finish.activated", { no: r.data }));
      router.refresh();
    }
  };

  const tplMeta = templates[v.type];
  const overrides = v.clauseOverrides ?? {};

  const typeCard = (type: ContractType, Icon: typeof Home) => (
    <button
      key={type}
      type="button"
      onClick={() => changeType(type)}
      aria-pressed={v.type === type}
      className={cn(
        "press flex flex-col items-start gap-4 rounded-[28px] p-6 text-start transition-colors",
        v.type === type
          ? "bg-ink text-on-ink shadow-[var(--sh-float)]"
          : "bg-paper hover:bg-paper-2 shadow-[var(--sh-card)]",
      )}
    >
      <span
        className={cn(
          "flex size-14 items-center justify-center rounded-[18px]",
          v.type === type ? "bg-on-ink text-ink" : "bg-inset",
        )}
      >
        <Icon className="size-7" />
      </span>
      <span className="text-[22px] font-semibold">{t(`type.${type}`)}</span>
      <span
        className={cn("text-[14px] leading-6", v.type === type ? "text-on-ink/75" : "text-label-2")}
      >
        {t(`type.${type}Text`)}
      </span>
    </button>
  );

  const stepBody = () => {
    switch (STEPS[step]) {
      case "type":
        return (
          <div className="grid gap-4 sm:grid-cols-2">
            {[typeCard("residential", Home), typeCard("investment", Store)]}
          </div>
        );

      case "parties":
        return (
          <div className="space-y-6">
            <Field label={t("parties.owner")} hint={t("parties.ownerHint")} htmlFor="w-owner">
              <Select
                id="w-owner"
                value={v.ownerId ?? ""}
                onChange={(e) => {
                  setOwnerTouched(true);
                  set("ownerId", e.target.value || null);
                }}
              >
                <option value="">—</option>
                {owners.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-label-2 text-[13px] font-medium">{t("parties.tenant")}</span>
                <Button variant="plain" size="sm" onClick={() => setTenantSheet(true)}>
                  <UserPlus />
                  {t("parties.newTenant")}
                </Button>
              </div>
              {tenant ? (
                <Card className="flex items-center gap-3 p-4">
                  <CheckCircle2 className="text-green size-6 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[16px] font-semibold">{tenant.name}</div>
                    <div className="text-label-2 num text-[13px]">
                      {[tenant.civilIdMasked, tenant.phones[0]].filter(Boolean).join(" · ")}
                    </div>
                    {tenant.blacklisted && (
                      <div className="text-red-text text-[13px]">{t("parties.blacklisted")}</div>
                    )}
                  </div>
                  <Button variant="tinted" size="sm" onClick={() => set("tenantId", "")}>
                    {t("parties.change")}
                  </Button>
                </Card>
              ) : (
                <>
                  <SearchField
                    value={tenantQuery}
                    onValueChange={setTenantQuery}
                    placeholder={t("parties.searchTenant")}
                    autoFocus
                  />
                  <ul className="bg-paper divide-separator divide-y-[0.5px] overflow-hidden rounded-[20px] shadow-[var(--sh-card)]">
                    {filteredTenants.map((x) => (
                      <li key={x.id}>
                        <button
                          type="button"
                          onClick={() => set("tenantId", x.id)}
                          className="hover:bg-paper-2 flex w-full items-center gap-3 px-4 py-3 text-start"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[15px] font-medium">{x.name}</div>
                            <div className="text-label-2 num text-[12px]">
                              {[x.civilIdMasked, x.phones[0]].filter(Boolean).join(" · ")}
                            </div>
                          </div>
                          {x.blacklisted && <AlertTriangle className="text-red-text size-4" />}
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
        );

      case "units":
        return (
          <div className="space-y-5">
            <Field label={t("units.property")}>
              <ChipScroller>
                {properties.map((p) => (
                  <Chip
                    key={p.id}
                    active={v.propertyId === p.id}
                    onClick={() => pickProperty(p.id)}
                    className="h-11 px-5 text-[15px]"
                  >
                    {p.name}
                  </Chip>
                ))}
              </ChipScroller>
            </Field>
            {property && (
              <Card className="p-4 sm:p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <p className="text-label-2 text-[14px]">{t("units.chooseUnits")}</p>
                  <span className="text-[14px] font-semibold">
                    {t("units.selected", { count: v.unitIds.length })}
                  </span>
                </div>
                <BuildingStack
                  units={property.stack}
                  mode="select"
                  selected={new Set(v.unitIds)}
                  onToggle={toggleUnit}
                  isDisabled={unitDisabled}
                />
              </Card>
            )}
          </div>
        );

      case "terms": {
        const presets = PURPOSE_PRESETS[v.type];
        return (
          <div className="grid gap-5 lg:grid-cols-2">
            <Field
              label={t("terms.contractDate")}
              htmlFor="w-cdate"
              hint={
                <span className="text-label font-medium">
                  {t("terms.dayName", {
                    day: locale === "ar" ? dayNameAr(v.contractDate) : dayNameEn(v.contractDate),
                  })}
                </span>
              }
            >
              <DatePicker
                id="w-cdate"
                value={v.contractDate}
                onChange={(d) => d && set("contractDate", d)}
              />
            </Field>
            <Field label={t("terms.startDate")} htmlFor="w-start">
              <DatePicker
                id="w-start"
                value={v.startDate}
                onChange={(d) =>
                  d &&
                  setV((s) => ({
                    ...s,
                    startDate: d,
                    firstCollectionDate:
                      s.firstCollectionDate < d || s.firstCollectionDate === s.startDate
                        ? firstCollectionFor(d, s.freeMonths)
                        : s.firstCollectionDate,
                  }))
                }
              />
            </Field>
            <Field
              label={t("terms.firstCollection")}
              htmlFor="w-first"
              hint={t("terms.grace", { count: grace })}
              className="lg:col-span-2"
            >
              <div className="space-y-2">
                <DatePicker
                  id="w-first"
                  value={v.firstCollectionDate}
                  min={v.startDate}
                  onChange={(d) => d && set("firstCollectionDate", d)}
                />
                <ChipScroller>
                  {[0, 1, 2, 3].map((n) => (
                    <Chip
                      key={n}
                      active={v.firstCollectionDate === addMonths(v.startDate, n)}
                      onClick={() => set("firstCollectionDate", addMonths(v.startDate, n))}
                    >
                      {n === 0 ? t("terms.sameDay") : t("terms.plusMonths", { n })}
                    </Chip>
                  ))}
                </ChipScroller>
              </div>
            </Field>
            <Field
              label={t("terms.term")}
              hint={t("terms.endsOn", { date: formatDate(endDate) })}
              className="lg:col-span-2"
            >
              <div className="space-y-2">
                <SegmentedControl
                  options={[
                    ...[12, 24, 36, 60].map((m) => ({
                      value: String(m),
                      label: t("terms.years", { n: m / 12 }),
                    })),
                    { value: "custom", label: t("terms.custom") },
                  ]}
                  value={termCustom ? "custom" : String(v.termMonths)}
                  onChange={(x) => {
                    if (x === "custom") setTermCustom(true);
                    else {
                      setTermCustom(false);
                      set("termMonths", Number(x));
                    }
                  }}
                />
                {termCustom && (
                  <div className="bg-paper flex items-center justify-between rounded-[14px] px-4 py-2">
                    <span>{t("terms.months")}</span>
                    <Stepper
                      value={v.termMonths}
                      onChange={(n) => set("termMonths", n)}
                      min={1}
                      max={600}
                      labels={{ decrement: tu("decrement"), increment: tu("increment") }}
                    />
                  </div>
                )}
              </div>
            </Field>
            <Field label={t("terms.rent")} htmlFor="w-rent" className="lg:col-span-2">
              <MoneyInput
                id="w-rent"
                size="lg"
                value={v.monthlyRentFils || null}
                onChange={(f) => set("monthlyRentFils", f ?? 0)}
              />
            </Field>
            <Field label={t("terms.purpose")} className="lg:col-span-2">
              <div className="space-y-2">
                <ChipScroller>
                  {presets.map((p) => (
                    <Chip
                      key={p}
                      active={!customPurpose && v.purpose === p}
                      onClick={() => {
                        setCustomPurpose(false);
                        set("purpose", p);
                      }}
                    >
                      {p}
                    </Chip>
                  ))}
                  <Chip
                    active={customPurpose}
                    onClick={() => {
                      setCustomPurpose(true);
                      set("purpose", "");
                    }}
                  >
                    {t("terms.purposeCustom")}
                  </Chip>
                </ChipScroller>
                {customPurpose && (
                  <Input
                    aria-label={t("terms.purposeCustom")}
                    value={v.purpose}
                    onChange={(e) => set("purpose", e.target.value)}
                    autoFocus
                  />
                )}
              </div>
            </Field>
            <Field label={t("terms.utilities")} className="lg:col-span-2">
              <SegmentedControl
                options={(["owner", "tenant"] as const).map((x) => ({
                  value: x,
                  label: tEnum(`utilitiesParty.${x}`),
                }))}
                value={v.utilitiesParty}
                onChange={(x) => set("utilitiesParty", x)}
              />
            </Field>
            {v.type === "investment" && (
              <>
                <Field label={t("terms.electricityFixed")} htmlFor="w-elec">
                  <MoneyInput
                    id="w-elec"
                    value={v.electricityFixedFils || null}
                    onChange={(f) => set("electricityFixedFils", f ?? 0)}
                  />
                </Field>
                <div className="space-y-3">
                  <div className="bg-paper flex items-center justify-between rounded-[14px] px-4 py-2.5">
                    <span className="text-[15px]">{t("terms.freeMonths")}</span>
                    <Stepper
                      value={v.freeMonths}
                      onChange={(n) =>
                        setV((s) => ({
                          ...s,
                          freeMonths: n,
                          firstCollectionDate: firstCollectionFor(s.startDate, n),
                        }))
                      }
                      min={0}
                      max={24}
                      labels={{ decrement: tu("decrement"), increment: tu("increment") }}
                    />
                  </div>
                  {v.freeMonths > 0 && (
                    <div className="bg-paper flex items-center justify-between rounded-[14px] px-4 py-2.5">
                      <span className="text-[15px]">{t("terms.penaltyWindow")}</span>
                      <Stepper
                        value={v.freeMonthsPenaltyWindowMonths}
                        onChange={(n) => set("freeMonthsPenaltyWindowMonths", n)}
                        min={0}
                        max={60}
                        labels={{ decrement: tu("decrement"), increment: tu("increment") }}
                      />
                    </div>
                  )}
                </div>
              </>
            )}
            <div className="space-y-3">
              <div className="bg-paper flex items-center justify-between rounded-[14px] px-4 py-2.5">
                <span className="text-[15px]">{t("terms.notice")}</span>
                <Stepper
                  value={v.noticePeriodMonths}
                  onChange={(n) => set("noticePeriodMonths", n)}
                  min={0}
                  max={12}
                  labels={{ decrement: tu("decrement"), increment: tu("increment") }}
                />
              </div>
              <label className="bg-paper flex items-center justify-between rounded-[14px] px-4 py-3">
                <span className="text-[15px]">{t("terms.autoRenew")}</span>
                <Toggle
                  checked={v.autoRenew}
                  onCheckedChange={(x) => set("autoRenew", x)}
                  ariaLabel={t("terms.autoRenew")}
                />
              </label>
            </div>
            <Field label={t("terms.deposit")} htmlFor="w-dep">
              <MoneyInput
                id="w-dep"
                value={v.securityDepositFils || null}
                onChange={(f) => set("securityDepositFils", f ?? 0)}
              />
            </Field>
            <Field label={t("terms.increase")} className="lg:col-span-2">
              <div className="space-y-2">
                <SegmentedControl
                  options={[
                    { value: "none", label: t("terms.increaseNone") },
                    { value: "percent", label: tEnum("increaseKind.percent") },
                    { value: "fixed", label: tEnum("increaseKind.fixed") },
                  ]}
                  value={v.annualIncrease?.kind ?? "none"}
                  onChange={(k) =>
                    set(
                      "annualIncrease",
                      k === "none"
                        ? null
                        : {
                            kind: k as "percent" | "fixed",
                            value: v.annualIncrease?.value ?? (k === "percent" ? 5 : 10_000),
                            everyMonths: v.annualIncrease?.everyMonths ?? 12,
                          },
                    )
                  }
                />
                {v.annualIncrease && (
                  <div className="grid grid-cols-2 gap-3">
                    {v.annualIncrease.kind === "percent" ? (
                      <Input
                        aria-label={t("terms.increaseValue")}
                        inputMode="decimal"
                        className="num"
                        value={v.annualIncrease.value}
                        onChange={(e) =>
                          set("annualIncrease", {
                            ...v.annualIncrease!,
                            value: Number(normalizeDigits(e.target.value)) || 0,
                          })
                        }
                      />
                    ) : (
                      <MoneyInput
                        value={v.annualIncrease.value}
                        onChange={(f) =>
                          set("annualIncrease", { ...v.annualIncrease!, value: f ?? 0 })
                        }
                        showWords={false}
                      />
                    )}
                    <Input
                      aria-label={t("terms.increaseEvery")}
                      inputMode="numeric"
                      className="num"
                      value={v.annualIncrease.everyMonths}
                      onChange={(e) =>
                        set("annualIncrease", {
                          ...v.annualIncrease!,
                          everyMonths: Number(normalizeDigits(e.target.value)) || 12,
                        })
                      }
                    />
                  </div>
                )}
              </div>
            </Field>
            <Field label={t("terms.notes")} htmlFor="w-notes" className="lg:col-span-2">
              <Textarea
                id="w-notes"
                value={v.notes ?? ""}
                onChange={(e) => set("notes", e.target.value)}
              />
            </Field>
          </div>
        );
      }

      case "clauses": {
        const rendered = preview?.rendered.clauses ?? [];
        const renderedByKey = new Map(rendered.map((c) => [c.key, c]));
        const custom = v.customClauses ?? [];
        return (
          <div className="space-y-4">
            <p className="text-label-2 text-[14px]">{t("clauses.hint")}</p>
            {!preview ? (
              <Skeleton className="h-64" />
            ) : (
              <ol className="bg-paper divide-separator divide-y-[0.5px] overflow-hidden rounded-[20px] shadow-[var(--sh-card)]">
                {tplMeta.map((c) => {
                  const r = renderedByKey.get(c.key);
                  const enabled = c.optional ? (overrides.enabled?.[c.key] ?? !!r) : true;
                  if (!r && !c.optional) return null;
                  const edited = overrides.text?.[c.key] !== undefined;
                  return (
                    <li key={c.key} className={cn("px-4 py-3.5", !enabled && "opacity-50")}>
                      <div className="flex items-start gap-3">
                        <span className="num text-label-2 mt-0.5 w-6 shrink-0 text-[14px] font-semibold">
                          {r?.number ?? "—"}
                        </span>
                        <div className="min-w-0 flex-1">
                          {editingClause === c.key ? (
                            <Textarea
                              autoFocus
                              rows={4}
                              value={overrides.text?.[c.key] ?? c.body}
                              onChange={(e) =>
                                set("clauseOverrides", {
                                  ...overrides,
                                  text: { ...(overrides.text ?? {}), [c.key]: e.target.value },
                                })
                              }
                              onBlur={() => setEditingClause(null)}
                            />
                          ) : (
                            <p className="text-[15px] leading-7">{r?.text ?? c.body}</p>
                          )}
                          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[13px]">
                            {c.optional && (
                              <span className="text-label-2">{t("clauses.optional")}</span>
                            )}
                            {edited && (
                              <span className="text-orange-text">{t("clauses.edited")}</span>
                            )}
                            <button
                              type="button"
                              className="text-link flex items-center gap-1"
                              onClick={() => setEditingClause(c.key)}
                            >
                              <Pencil className="size-3.5" />
                              {t("clauses.edit")}
                            </button>
                            {edited && (
                              <button
                                type="button"
                                className="text-link flex items-center gap-1"
                                onClick={() => {
                                  const text = Object.fromEntries(
                                    Object.entries(overrides.text ?? {}).filter(
                                      ([k]) => k !== c.key,
                                    ),
                                  );
                                  set("clauseOverrides", { ...overrides, text });
                                }}
                              >
                                <RotateCcw className="size-3.5" />
                                {t("clauses.reset")}
                              </button>
                            )}
                          </div>
                        </div>
                        {c.optional && (
                          <Toggle
                            checked={enabled}
                            ariaLabel={c.key}
                            onCheckedChange={(x) =>
                              set("clauseOverrides", {
                                ...overrides,
                                enabled: { ...(overrides.enabled ?? {}), [c.key]: x },
                              })
                            }
                          />
                        )}
                      </div>
                    </li>
                  );
                })}
                {custom.map((c, i) => (
                  <li key={c.key} className="flex items-start gap-3 px-4 py-3.5">
                    <span className="num text-label-2 mt-2 w-6 shrink-0 text-[14px] font-semibold">
                      {renderedByKey.get(c.key)?.number ?? "—"}
                    </span>
                    <Textarea
                      rows={3}
                      aria-label={t("clauses.customPlaceholder")}
                      placeholder={t("clauses.customPlaceholder")}
                      value={c.text}
                      onChange={(e) =>
                        set(
                          "customClauses",
                          custom.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)),
                        )
                      }
                    />
                    <div className="flex flex-col gap-1">
                      <button
                        type="button"
                        aria-label={t("clauses.moveUp")}
                        disabled={i === 0}
                        className="bg-inset flex size-8 items-center justify-center rounded-full disabled:opacity-30"
                        onClick={() => {
                          const n = [...custom];
                          [n[i - 1], n[i]] = [n[i]!, n[i - 1]!];
                          set("customClauses", n);
                        }}
                      >
                        <ArrowUp className="size-4" />
                      </button>
                      <button
                        type="button"
                        aria-label={t("clauses.moveDown")}
                        disabled={i === custom.length - 1}
                        className="bg-inset flex size-8 items-center justify-center rounded-full disabled:opacity-30"
                        onClick={() => {
                          const n = [...custom];
                          [n[i + 1], n[i]] = [n[i]!, n[i + 1]!];
                          set("customClauses", n);
                        }}
                      >
                        <ArrowDown className="size-4" />
                      </button>
                      <button
                        type="button"
                        aria-label={tc("actions.deleteDraft")}
                        className="bg-inset text-red-text flex size-8 items-center justify-center rounded-full"
                        onClick={() =>
                          set(
                            "customClauses",
                            custom.filter((_, j) => j !== i),
                          )
                        }
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
            )}
            <Button
              variant="secondary"
              onClick={() =>
                set("customClauses", [
                  ...custom,
                  { key: `custom_${Date.now().toString(36)}`, text: "" },
                ])
              }
            >
              <Plus />
              {t("clauses.addCustom")}
            </Button>
          </div>
        );
      }

      case "review":
        return (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
            <Card className="overflow-hidden p-0">
              <div className="text-label-2 border-separator border-b-[0.5px] px-5 py-3 text-[13px] font-medium">
                {t("review.preview")}
              </div>
              <div className="bg-inset/60 overflow-x-auto p-3 sm:p-6">
                {preview && tenant ? (
                  <div
                    className="mx-auto w-[210mm] origin-top scale-[0.45] bg-white p-[18mm] shadow-[var(--sh-float)] max-sm:-mb-[160mm] sm:-mb-[118mm] sm:scale-[0.6] xl:-mb-[82mm] xl:scale-[0.72]"
                    style={{ minHeight: "297mm" }}
                  >
                    <ContractDocument
                      rendered={preview.rendered}
                      contractNo="—"
                      ownerName={owners.find((o) => o.id === v.ownerId)?.name ?? ""}
                      tenantName={tenant.name}
                    />
                  </div>
                ) : (
                  <Skeleton className="mx-auto h-96 w-72" />
                )}
              </div>
            </Card>
            <div className="space-y-4">
              <Card className="p-5">
                <h3 className="mb-3 text-[17px] font-semibold">{t("review.warnings")}</h3>
                {previewing && !preview ? (
                  <Skeleton className="h-10" />
                ) : preview?.warnings.length ? (
                  <ul className="space-y-2">
                    {preview.warnings.map((w) => (
                      <li key={w} className="flex gap-2 text-[14px]">
                        <AlertTriangle
                          className={cn(
                            "mt-0.5 size-4 shrink-0",
                            w === "overlap" ? "text-red-text" : "text-orange-text",
                          )}
                        />
                        {t(`warnings.${w}` as "warnings.overlap")}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-green-text flex items-center gap-2 text-[14px]">
                    <Check className="size-4" />
                    {t("review.noWarnings")}
                  </p>
                )}
              </Card>
              <Card className="p-5">
                <h3 className="mb-3 text-[17px] font-semibold">{t("review.schedule")}</h3>
                <ul className="divide-separator divide-y-[0.5px]">
                  {(preview?.schedule ?? []).map((s) => (
                    <li
                      key={s.period + s.kind}
                      className="flex items-center justify-between py-2 text-[14px]"
                    >
                      <span>
                        {formatPeriod(s.period, locale)}{" "}
                        <span className="text-label-2">
                          · {tEnum(`chargeKind.${s.kind}` as "chargeKind.rent")}
                        </span>
                      </span>
                      <span className={cn("num", s.kind === "free" && "text-teal-text")}>
                        {s.kind === "free" ? money(s.waivedValueFils) : money(s.amountFils)}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          </div>
        );

      case "finish":
        return (
          <div className="mx-auto max-w-xl space-y-6 py-4 text-center">
            <AnimatePresence mode="wait">
              {activatedNo ? (
                <m.div
                  key="done"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="space-y-5"
                >
                  <CheckCircle2 className="text-green mx-auto size-16" />
                  <h2 className="text-[26px] font-semibold">
                    {t("finish.activated", { no: activatedNo })}
                  </h2>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Button asChild size="lg" variant="secondary">
                      <a
                        href={`/print/contract/${draftId}?lang=ar&auto=1`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Printer />
                        {t("finish.print")}
                      </a>
                    </Button>
                    <Button asChild size="lg" variant="secondary">
                      <a
                        href={`/print/contract/${draftId}?lang=ar&auto=1`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <FileText />
                        {t("finish.pdf")}
                      </a>
                    </Button>
                    <Button size="lg" variant="secondary" onClick={() => fileRef.current?.click()}>
                      <Upload />
                      {t("finish.upload")}
                    </Button>
                    <Button asChild size="lg">
                      <Link href={`/contracts/${draftId}`}>{t("finish.open")}</Link>
                    </Button>
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    hidden
                    accept="image/*,application/pdf"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f || !draftId) return;
                      const fd = new FormData();
                      fd.set("file", f);
                      await exec(() => uploadSignedContract(draftId, fd), {
                        success: tc("uploaded"),
                      });
                    }}
                  />
                </m.div>
              ) : (
                <m.div key="ready" className="space-y-5">
                  <h2 className="text-[26px] font-semibold">{t("finish.title")}</h2>
                  <p className="text-label-2 text-[16px]">{t("finish.text")}</p>
                  {preview?.warnings.includes("overlap") && (
                    <p className="bg-red/10 text-red-text rounded-[14px] px-4 py-3 text-[14px]">
                      {t("warnings.overlap")}
                    </p>
                  )}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Button
                      size="lg"
                      variant="secondary"
                      loading={pending}
                      onClick={async () => {
                        const r = await saveDraft();
                        if (r.ok) router.push(`/contracts/${r.data}`);
                      }}
                    >
                      {t("finish.saveDraft")}
                    </Button>
                    <Button
                      size="lg"
                      loading={pending}
                      onClick={activate}
                      disabled={preview?.warnings.includes("overlap")}
                    >
                      {t("finish.activate")}
                    </Button>
                  </div>
                </m.div>
              )}
            </AnimatePresence>
          </div>
        );
    }
  };

  return (
    <>
      <LargeTitleHeader
        title={draftId ? t("editDraft") : t("title")}
        back={{ href: "/contracts", label: tc("title") }}
        actions={
          <Button
            variant="tinted"
            size="icon"
            aria-label={t("leave")}
            onClick={() => router.push("/contracts")}
          >
            <X />
          </Button>
        }
      />
      <Card className="p-4 sm:p-6 lg:p-8">
        <Wizard
          steps={STEPS.map((s) => t(`steps.${s}`))}
          current={step}
          onBack={() => setStep((s) => Math.max(0, s - 1))}
          onNext={next}
          nextDisabled={!canNext}
          nextLoading={pending && STEPS[step] !== "finish"}
          onSaveDraft={step >= 3 && !activatedNo ? () => void saveDraft() : undefined}
          saving={pending}
          hideFooter={STEPS[step] === "finish"}
        >
          <AnimatePresence mode="wait">
            <m.div
              key={step}
              initial={{ opacity: 0, x: locale === "ar" ? -16 : 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {stepBody()}
            </m.div>
          </AnimatePresence>
        </Wizard>
        {STEPS[step] === "finish" && !activatedNo && (
          <div className="mt-6 flex justify-start">
            <Button variant="tinted" onClick={() => setStep(STEPS.length - 2)}>
              {t("back")}
            </Button>
          </div>
        )}
      </Card>
      <TenantFormSheet
        open={tenantSheet}
        onOpenChange={setTenantSheet}
        onSaved={(row) => {
          setTenants((ts) => [
            {
              id: row.id,
              name: row.full_name,
              civilIdMasked: "",
              civilId: "",
              phones: [],
              blacklisted: false,
            },
            ...ts,
          ]);
          set("tenantId", row.id);
        }}
      />
    </>
  );
}
