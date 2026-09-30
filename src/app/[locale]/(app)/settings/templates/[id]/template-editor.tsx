"use client";
import { useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Braces, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { SettingsShell } from "@/components/domain/settings/settings-shell";
import { Card } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import { ContractDocument } from "@/components/print/contract-document";
import { useAction } from "@/hooks/use-action";
import { saveTemplateVersion } from "@/server/actions/settings";
import {
  buildTemplateVars,
  isValidCondition,
  isValidTemplateText,
  referencedVariables,
  renderContract,
  TEMPLATE_VARIABLES,
  type TemplateClause,
} from "@/domain/templates";
import type { LoadedTemplate } from "@/server/queries/contracts";

const EXTRA_VARS = [
  "auto_renew",
  "utilities_owner",
  "utilities_party",
  "free_months",
  "security_deposit_fils",
  "electricity_fixed_fils",
  "property_type",
  "first_collection_differs",
  "contract_type",
  "term_months",
  "notice_period_months",
];

function sampleVars(type: "residential" | "investment") {
  return buildTemplateVars({
    contractNo: type === "residential" ? "R-2026-0001" : "I-2026-0001",
    type,
    contractDate: "2026-10-01",
    startDate: "2026-10-01",
    firstCollectionDate: type === "investment" ? "2026-12-01" : "2026-10-01",
    endDate: "2031-09-30",
    termMonths: 60,
    autoRenew: type === "investment",
    monthlyRentFils: type === "investment" ? 650000 : 400000,
    purpose: type === "investment" ? "مكتب عقاري" : "سكن عائلي",
    utilitiesParty: "owner",
    electricityFixedFils: type === "investment" ? 3750 : 0,
    freeMonths: type === "investment" ? 2 : 0,
    noticePeriodMonths: type === "investment" ? 1 : 2,
    securityDepositFils: 0,
    owner: { name: "المالك", civilId: "285010112358", phones: ["55123456"] },
    tenant: { name: "المستأجر", civilId: "290020212345", phones: ["99112233"] },
    property: {
      area: "الري",
      block: "1",
      street: "22",
      houseOrPlot: "1674",
      paciNo: "30498812",
      propertyType: type === "investment" ? "industrial" : "residential",
    },
    units: [{ label: "8", type: type === "investment" ? "shop" : "apartment", paciNo: "30498840" }],
  });
}

export function TemplateEditor({ template }: { template: LoadedTemplate }) {
  const t = useTranslations("settings.templates");
  const router = useRouter();
  const { exec, pending } = useAction();
  const [name, setName] = useState(template.name);
  const [preamble, setPreamble] = useState(template.preamble);
  const [clauses, setClauses] = useState<TemplateClause[]>(template.clauses.map((c) => ({ ...c })));
  const focused = useRef<{ el: HTMLTextAreaElement; apply: (v: string) => void } | null>(null);
  const known = new Set<string>([...TEMPLATE_VARIABLES, ...EXTRA_VARS]);
  const vars = useMemo(() => sampleVars(template.type), [template.type]);
  const issues = (text: string, cond?: string | null) => {
    if (!isValidTemplateText(text)) return t("invalid");
    if (cond && !isValidCondition(cond)) return t("invalid");
    const unknown = referencedVariables(text).find((v) => !known.has(v));
    return unknown ? t("unknownVar", { name: unknown }) : null;
  };
  const preview = useMemo(() => {
    try {
      return renderContract(
        { ...template, preamble, clauses: clauses.map((c, i) => ({ ...c, position: i + 1 })) },
        vars,
      );
    } catch {
      return null;
    }
  }, [template, preamble, clauses, vars]);
  const setClause = (i: number, patch: Partial<TemplateClause>) =>
    setClauses((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const insertVar = (v: string) => {
    const f = focused.current;
    if (!f) return;
    const { selectionStart: s, selectionEnd: e, value } = f.el;
    f.apply(`${value.slice(0, s)}{{${v}}}${value.slice(e)}`);
  };
  const track = (apply: (v: string) => void) => ({
    onFocus: (e: React.FocusEvent<HTMLTextAreaElement>) =>
      (focused.current = { el: e.currentTarget, apply }),
  });
  const hasIssues = !!issues(preamble) || clauses.some((c) => !!issues(c.body, c.condition));

  return (
    <SettingsShell title={t("edit")} wide>
      <div className="flex flex-wrap items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary">
              <Braces />
              {t("variables")}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="max-h-80 overflow-y-auto">
            {[...TEMPLATE_VARIABLES, "clause_ref:term"].map((v) => (
              <DropdownMenuItem key={v} onSelect={() => insertVar(v)}>
                <span className="num" dir="ltr">{`{{${v}}}`}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          loading={pending}
          disabled={hasIssues}
          onClick={() =>
            exec(
              () =>
                saveTemplateVersion({
                  baseId: template.id,
                  name,
                  preamble,
                  closing: template.closing ?? null,
                  clauses: clauses.map((c) => ({
                    key: c.key,
                    body: c.body,
                    condition: c.condition ?? null,
                    defaultCondition: c.defaultCondition ?? null,
                    optional: !!c.optional,
                    defaultEnabled: c.defaultEnabled ?? true,
                  })),
                }),
              {
                onSuccess: (v) => {
                  toast.success(t("savedVersion", { n: v }));
                  router.push("/settings/templates");
                  router.refresh();
                },
              },
            )
          }
        >
          {t("saveVersion")}
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <div className="min-w-0 space-y-6">
          <Card className="space-y-4 p-5">
            <Field label={t("type")} htmlFor="tpl-name">
              <Input id="tpl-name" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label={t("preamble")} htmlFor="tpl-pre" error={issues(preamble) ?? undefined}>
              <Textarea
                id="tpl-pre"
                rows={9}
                value={preamble}
                onChange={(e) => setPreamble(e.target.value)}
                {...track(setPreamble)}
              />
            </Field>
          </Card>
          <section className="space-y-3">
            <h2 className="text-[20px] font-semibold">{t("clauses")}</h2>
            {clauses.map((c, i) => (
              <Card key={i} className="space-y-3 p-4">
                <div className="flex items-center gap-2">
                  <span className="num text-label-2 w-6 text-[14px] font-semibold">{i + 1}</span>
                  <Input
                    aria-label={t("key")}
                    dir="ltr"
                    className="num h-10 flex-1 text-[14px]"
                    value={c.key}
                    onChange={(e) =>
                      setClause(i, { key: e.target.value.replace(/[^a-z0-9_]/g, "") })
                    }
                  />
                  <button
                    type="button"
                    aria-label="↑"
                    disabled={i === 0}
                    onClick={() =>
                      setClauses((cs) => {
                        const n = [...cs];
                        [n[i - 1], n[i]] = [n[i]!, n[i - 1]!];
                        return n;
                      })
                    }
                    className="bg-inset flex size-9 items-center justify-center rounded-full disabled:opacity-30"
                  >
                    <ArrowUp className="size-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="↓"
                    disabled={i === clauses.length - 1}
                    onClick={() =>
                      setClauses((cs) => {
                        const n = [...cs];
                        [n[i + 1], n[i]] = [n[i]!, n[i + 1]!];
                        return n;
                      })
                    }
                    className="bg-inset flex size-9 items-center justify-center rounded-full disabled:opacity-30"
                  >
                    <ArrowDown className="size-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="×"
                    onClick={() => setClauses((cs) => cs.filter((_, j) => j !== i))}
                    className="bg-inset text-red-text flex size-9 items-center justify-center rounded-full"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
                <Textarea
                  aria-label={c.key}
                  rows={3}
                  value={c.body}
                  onChange={(e) => setClause(i, { body: e.target.value })}
                  {...track((v) => setClause(i, { body: v }))}
                />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                  <Input
                    aria-label={t("condition")}
                    placeholder={t("condition")}
                    dir="ltr"
                    className="num h-10 text-[13px]"
                    value={c.condition ?? ""}
                    onChange={(e) => setClause(i, { condition: e.target.value || null })}
                  />
                  <label className="flex items-center gap-2 text-[14px]">
                    {t("optional")}
                    <Toggle
                      checked={!!c.optional}
                      ariaLabel={t("optional")}
                      onCheckedChange={(v) => setClause(i, { optional: v })}
                    />
                  </label>
                  <label className="flex items-center gap-2 text-[14px]">
                    {t("defaultOn")}
                    <Toggle
                      checked={c.defaultEnabled ?? true}
                      ariaLabel={t("defaultOn")}
                      onCheckedChange={(v) => setClause(i, { defaultEnabled: v })}
                    />
                  </label>
                </div>
                {issues(c.body, c.condition) && (
                  <p className="text-red-text text-[13px]">{issues(c.body, c.condition)}</p>
                )}
              </Card>
            ))}
            <Button
              variant="secondary"
              onClick={() =>
                setClauses((cs) => [
                  ...cs,
                  {
                    key: `clause_${cs.length + 1}`,
                    position: cs.length + 1,
                    body: "",
                    condition: null,
                    optional: false,
                    defaultEnabled: true,
                  },
                ])
              }
            >
              <Plus />
              {t("addClause")}
            </Button>
          </section>
        </div>
        <aside className="min-w-0 xl:sticky xl:top-20 xl:max-h-[calc(100dvh-6rem)] xl:self-start xl:overflow-y-auto">
          <h2 className="mb-3 text-[20px] font-semibold">{t("sample")}</h2>
          <div className="bg-inset/60 overflow-x-auto rounded-[24px] p-3">
            {preview && (
              <div className="mx-auto w-[210mm] [zoom:0.5] bg-white p-[18mm] text-black shadow-sm">
                <ContractDocument
                  rendered={preview}
                  contractNo={String(vars.contract_no)}
                  ownerName="المالك"
                  tenantName="المستأجر"
                />
              </div>
            )}
          </div>
        </aside>
      </div>
    </SettingsShell>
  );
}
