"use client";
import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { ArrowLeft, ArrowRight, Building2, Check, ImagePlus, Settings2, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { SegmentedControl } from "@/components/ui/segmented";
import { Stepper } from "@/components/ui/stepper";
import { KUWAIT_GOVERNORATES, OTHER_AREA } from "@/data/kuwait-addresses";
import { digitsOnly } from "@/domain/validation";
import { completeSetup } from "@/server/actions/auth";
import { savePreferences } from "@/server/actions/preferences";
import { uploadOrgLogo } from "@/server/actions/settings";
import { cn } from "@/lib/utils";

type Prefs = {
  locale: "ar" | "en";
  digits: "latn" | "arab";
  theme: "light" | "dark" | "system";
  density: "comfortable" | "compact";
};

type FirstProperty = {
  enabled: boolean;
  name: string;
  governorate: string;
  area: string;
  block: string;
  street: string;
  houseOrPlot: string;
  paciNo: string;
  count: number;
  rentFils: number | null;
};

const TOTAL = 5;

export function SetupWizard({ userName, defaultLocale }: { userName: string; defaultLocale: "ar" | "en" }) {
  const t = useTranslations("setup");
  const tErr = useTranslations("errors");
  const tUi = useTranslations("ui");
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [logo, setLogo] = useState<File | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<Prefs>({
    locale: defaultLocale,
    digits: "latn",
    theme: "system",
    density: "comfortable",
  });
  const [property, setProperty] = useState<FirstProperty>({
    enabled: true,
    name: "",
    governorate: "",
    area: "",
    block: "",
    street: "",
    houseOrPlot: "",
    paciNo: "",
    count: 8,
    rentFils: null,
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const pickLogo = (file: File | null) => {
    setLogo(file);
    setLogoUrl(file ? URL.createObjectURL(file) : null);
  };

  const canNext = () => {
    if (step === 1) return name.trim().length >= 2;
    if (step === 3)
      return (
        !property.enabled ||
        (property.name.trim().length >= 1 &&
          property.governorate.trim().length > 0 &&
          property.area.trim().length > 0 &&
          property.block.trim().length > 0 &&
          property.street.trim().length > 0 &&
          property.houseOrPlot.trim().length > 0 &&
          /^\d{8}$/.test(digitsOnly(property.paciNo)))
      );
    return true;
  };

  const next = () => {
    setError(null);
    if (step === 1 && name.trim().length < 2) return setError(t("errors.nameRequired"));
    setStep((s) => Math.min(TOTAL - 1, s + 1));
  };

  const finish = () => {
    setError(null);
    start(async () => {
      const r = await completeSetup({
        name: name.trim(),
        nameEn: nameEn.trim() || undefined,
        prefs,
        firstProperty:
          property.enabled && property.name.trim()
            ? {
                name: property.name.trim(),
                governorate: property.governorate.trim(),
                area: property.area.trim(),
                block: property.block.trim(),
                street: property.street.trim(),
                houseOrPlot: property.houseOrPlot.trim(),
                paciNo: digitsOnly(property.paciNo),
                count: property.count,
                askingRentFils: property.rentFils ?? 0,
              }
            : undefined,
      });
      if (!r.ok) return setError(tErr(r.error as "generic"));
      if (logo) {
        const fd = new FormData();
        fd.set("file", logo);
        await uploadOrgLogo(fd);
      }
      await savePreferences(prefs);
      window.location.href = `/${prefs.locale}/dashboard?tour=1`;
    });
  };

  return (
    <div className="relative grid min-h-dvh place-items-center bg-[var(--brand-dusk)] px-4 py-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background-image:url(/brand/arch-pattern.svg)] [background-size:48px_56px] opacity-[0.04] dark:invert"
      />
      <Card className="relative w-full max-w-[560px] rounded-[32px] p-6 shadow-[var(--sh-float)] sm:p-8">
        <div className="mb-5 flex items-center justify-between">
          <Image src="/brand/mark.svg" alt="" width={36} height={36} className="dark:invert" priority />
          <div
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={TOTAL}
            aria-valuenow={step + 1}
            aria-label={t("stepOf", { n: step + 1, total: TOTAL })}
            className="flex items-center gap-1.5"
          >
            {Array.from({ length: TOTAL }, (_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === step ? "bg-ink w-5" : i < step ? "bg-ink/60 w-1.5" : "bg-separator w-1.5",
                )}
              />
            ))}
          </div>
        </div>

        {step === 0 && (
          <div className="space-y-5">
            <div className="bg-inset text-label flex size-12 items-center justify-center rounded-[16px]">
              <Sparkles className="size-6" />
            </div>
            <div>
              <h1 className="text-[26px] leading-tight font-semibold">
                {t("welcome.title", { name: userName })}
              </h1>
              <p className="text-label-2 mt-2 text-[15px] leading-6">{t("welcome.text")}</p>
            </div>
            <ul className="space-y-2.5">
              {[t("welcome.point1"), t("welcome.point2"), t("welcome.point3")].map((p) => (
                <li key={p} className="flex items-start gap-2.5 text-[15px]">
                  <Check className="text-green-text mt-0.5 size-5 shrink-0" />
                  {p}
                </li>
              ))}
            </ul>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <div className="bg-inset text-label flex size-12 items-center justify-center rounded-[16px]">
              <Building2 className="size-6" />
            </div>
            <div>
              <h1 className="text-[24px] leading-tight font-semibold">{t("office.title")}</h1>
              <p className="text-label-2 mt-1.5 text-[15px] leading-6">{t("office.text")}</p>
            </div>
            <Field label={t("office.name")} htmlFor="s-name" error={error ?? undefined}>
              <Input
                id="s-name"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => name && name.trim().length < 2 && setError(t("errors.nameRequired"))}
              />
            </Field>
            <Field label={t("office.nameEn")} htmlFor="s-name-en">
              <Input
                id="s-name-en"
                dir="ltr"
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
              />
            </Field>
            <Field label={t("office.logo")} htmlFor="s-logo" hint={t("office.logoHint")}>
              <input
                ref={fileRef}
                id="s-logo"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={(e) => pickLogo(e.target.files?.[0] ?? null)}
              />
              <div className="flex items-center gap-3">
                {logoUrl ? (
                  <Image
                    src={logoUrl}
                    alt=""
                    width={52}
                    height={52}
                    unoptimized
                    className="bg-inset size-13 rounded-[14px] object-contain p-1"
                  />
                ) : (
                  <span className="bg-inset text-label-2 flex size-13 items-center justify-center rounded-[14px]">
                    <ImagePlus className="size-5" />
                  </span>
                )}
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => fileRef.current?.click()}
                  disabled={pending}
                >
                  {logo ? t("office.changeLogo") : t("office.chooseLogo")}
                </Button>
              </div>
            </Field>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div className="bg-inset text-label flex size-12 items-center justify-center rounded-[16px]">
              <Settings2 className="size-6" />
            </div>
            <div>
              <h1 className="text-[24px] leading-tight font-semibold">{t("prefs.title")}</h1>
              <p className="text-label-2 mt-1.5 text-[15px] leading-6">{t("prefs.text")}</p>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="text-label-2 text-[13px] font-medium">{t("prefs.language")}</div>
                <SegmentedControl
                  ariaLabel={t("prefs.language")}
                  value={prefs.locale}
                  onChange={(v) => setPrefs((p) => ({ ...p, locale: v }))}
                  options={[
                    { value: "ar", label: "العربية" },
                    { value: "en", label: "English" },
                  ]}
                />
              </div>
              <div className="space-y-2">
                <div className="text-label-2 text-[13px] font-medium">{t("prefs.digits")}</div>
                <SegmentedControl
                  ariaLabel={t("prefs.digits")}
                  value={prefs.digits}
                  onChange={(v) => setPrefs((p) => ({ ...p, digits: v }))}
                  options={[
                    { value: "latn", label: t("prefs.digitsLatn") },
                    { value: "arab", label: t("prefs.digitsArab") },
                  ]}
                />
              </div>
              <div className="space-y-2">
                <div className="text-label-2 text-[13px] font-medium">{t("prefs.theme")}</div>
                <SegmentedControl
                  ariaLabel={t("prefs.theme")}
                  value={prefs.theme}
                  onChange={(v) => setPrefs((p) => ({ ...p, theme: v }))}
                  options={[
                    { value: "light", label: t("prefs.themeLight") },
                    { value: "dark", label: t("prefs.themeDark") },
                    { value: "system", label: t("prefs.themeSystem") },
                  ]}
                />
              </div>
              <div className="space-y-2">
                <div className="text-label-2 text-[13px] font-medium">{t("prefs.density")}</div>
                <SegmentedControl
                  ariaLabel={t("prefs.density")}
                  value={prefs.density}
                  onChange={(v) => setPrefs((p) => ({ ...p, density: v }))}
                  options={[
                    { value: "comfortable", label: t("prefs.densityComfortable") },
                    { value: "compact", label: t("prefs.densityCompact") },
                  ]}
                />
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <div className="bg-inset text-label flex size-12 items-center justify-center rounded-[16px]">
              <Building2 className="size-6" />
            </div>
            <div>
              <h1 className="text-[24px] leading-tight font-semibold">{t("property.title")}</h1>
              <p className="text-label-2 mt-1.5 text-[15px] leading-6">{t("property.text")}</p>
            </div>
            <label className="bg-inset/60 flex items-center gap-3 rounded-[16px] p-3.5 text-[14px]">
              <input
                type="checkbox"
                checked={!property.enabled}
                onChange={(e) => setProperty((p) => ({ ...p, enabled: !e.target.checked }))}
                className="accent-ink size-4"
              />
              {t("property.skipToggle")}
            </label>
            {property.enabled && (
              <div className="space-y-4">
                <Field label={t("property.name")} htmlFor="p-name" error={error ?? undefined}>
                  <Input
                    id="p-name"
                    autoFocus
                    placeholder={t("property.placeholder")}
                    value={property.name}
                    onChange={(e) => setProperty((p) => ({ ...p, name: e.target.value }))}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label={t("property.governorate")} htmlFor="p-governorate">
                    <Select
                      id="p-governorate"
                      value={property.governorate}
                      onChange={(e) =>
                        setProperty((p) => ({ ...p, governorate: e.target.value, area: "" }))
                      }
                    >
                      <option value="">{t("property.selectGovernorate")}</option>
                      {KUWAIT_GOVERNORATES.map((g) => (
                        <option key={g.value} value={g.value}>
                          {prefs.locale === "en" ? g.en : g.ar}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label={t("property.area")} htmlFor="p-area">
                    <Select
                      id="p-area"
                      value={property.area}
                      disabled={!property.governorate}
                      onChange={(e) => setProperty((p) => ({ ...p, area: e.target.value }))}
                    >
                      <option value="">{t("property.selectArea")}</option>
                      {(
                        KUWAIT_GOVERNORATES.find((g) => g.value === property.governorate)?.areas ??
                        []
                      ).map((a) => (
                        <option key={a.value} value={a.value}>
                          {prefs.locale === "en" ? a.en : a.ar}
                        </option>
                      ))}
                      <option value={OTHER_AREA.value}>
                        {prefs.locale === "en" ? OTHER_AREA.en : OTHER_AREA.ar}
                      </option>
                    </Select>
                  </Field>
                  <Field label={t("property.block")} htmlFor="p-block">
                    <Input
                      id="p-block"
                      inputMode="numeric"
                      placeholder={t("property.blockPlaceholder")}
                      value={property.block}
                      onChange={(e) => setProperty((p) => ({ ...p, block: e.target.value }))}
                    />
                  </Field>
                  <Field label={t("property.street")} htmlFor="p-street">
                    <Input
                      id="p-street"
                      placeholder={t("property.streetPlaceholder")}
                      value={property.street}
                      onChange={(e) => setProperty((p) => ({ ...p, street: e.target.value }))}
                    />
                  </Field>
                  <Field label={t("property.houseOrPlot")} htmlFor="p-house">
                    <Input
                      id="p-house"
                      inputMode="numeric"
                      placeholder={t("property.houseOrPlotPlaceholder")}
                      value={property.houseOrPlot}
                      onChange={(e) => setProperty((p) => ({ ...p, houseOrPlot: e.target.value }))}
                    />
                  </Field>
                  <Field label={t("property.paci")} htmlFor="p-paci">
                    <Input
                      id="p-paci"
                      dir="ltr"
                      inputMode="numeric"
                      maxLength={8}
                      className="num"
                      placeholder={t("property.paciPlaceholder")}
                      value={property.paciNo}
                      onChange={(e) =>
                        setProperty((p) => ({ ...p, paciNo: digitsOnly(e.target.value) }))
                      }
                    />
                  </Field>
                </div>
                <p className="text-label-2 text-[13px] leading-5">{t("property.requiredHint")}</p>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[15px] font-medium">{t("property.units")}</span>
                  <Stepper
                    value={property.count}
                    min={1}
                    max={200}
                    onChange={(count) => setProperty((p) => ({ ...p, count }))}
                    labels={{ decrement: tUi("decrement"), increment: tUi("increment") }}
                  />
                </div>
                <Field label={t("property.rent")} htmlFor="p-rent">
                  <MoneyInput
                    id="p-rent"
                    value={property.rentFils}
                    onChange={(rentFils) => setProperty((p) => ({ ...p, rentFils }))}
                  />
                </Field>
              </div>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-5 text-center">
            <div className="bg-green/12 text-green-text mx-auto flex size-14 items-center justify-center rounded-full">
              <Check className="size-7" />
            </div>
            <div>
              <h1 className="text-[24px] leading-tight font-semibold">{t("done.title")}</h1>
              <p className="text-label-2 mt-1.5 text-[15px] leading-6">
                {t("done.text", { org: name.trim() })}
              </p>
            </div>
          </div>
        )}

        {error && step !== 1 && step !== 3 && (
          <p role="alert" className="bg-red/10 text-red-text mt-4 rounded-[14px] px-4 py-3 text-[14px]">
            {error}
          </p>
        )}

        <div className="mt-7 flex items-center gap-3">
          {step > 0 && step < 4 && (
            <Button variant="secondary" size="lg" onClick={() => setStep((s) => s - 1)} disabled={pending}>
              <ArrowLeft className="size-5 rtl:rotate-180" />
              {t("back")}
            </Button>
          )}
          {step === 3 && (
            <Button
              variant="plain"
              onClick={() => {
                setProperty((p) => ({ ...p, enabled: false }));
                next();
              }}
              disabled={pending}
            >
              {t("skip")}
            </Button>
          )}
          <div className="flex-1" />
          {step < 4 ? (
            <Button size="lg" onClick={next} disabled={!canNext() || pending}>
              {t("next")}
              <ArrowRight className="size-5 rtl:rotate-180" />
            </Button>
          ) : (
            <Button size="lg" block loading={pending} onClick={finish}>
              {t("done.start")}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
