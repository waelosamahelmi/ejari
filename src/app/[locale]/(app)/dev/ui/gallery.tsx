"use client";
/* Developer gallery: every primitive in light/dark and RTL/LTR (admin only). Sample copy is illustrative. */
import { useState, type ReactNode } from "react";
import {
  Bath,
  BedDouble,
  Building2,
  ChevronRight,
  Gauge,
  HandCoins,
  Heart,
  Layers,
  Ruler,
  Share2,
  Store,
  Warehouse,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { GlassButton, GlassPill } from "@/components/ui/glass";
import { GroupedList, GroupedSection, ListRow } from "@/components/ui/grouped-list";
import { IconTile } from "@/components/ui/icon-tile";
import { SegmentedControl } from "@/components/ui/segmented";
import { Toggle } from "@/components/ui/toggle";
import { Stepper } from "@/components/ui/stepper";
import {
  Chip,
  ChipScroller,
  ContractStatusPill,
  IconChip,
  PeriodStatusPill,
  UnitStatusPill,
} from "@/components/ui/chip";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { SearchField } from "@/components/ui/search-field";
import { MoneyInput } from "@/components/ui/money-input";
import { PhoneInput } from "@/components/ui/phone-input";
import { CivilIdInput } from "@/components/ui/civil-id-input";
import { DatePicker } from "@/components/ui/date-picker";
import { MonthPicker } from "@/components/ui/month-picker";
import { Sheet } from "@/components/ui/sheet";
import { AlertDialog } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { BarMini, Donut, Heatmap, Meter, ProgressRing, Sparkline } from "@/components/ui/charts";
import { RollingNumber } from "@/components/ui/rolling-number";
import { DataTable } from "@/components/ui/data-table";
import { PhotoHero } from "@/components/ui/photo-hero";
import { PropertyPhotoCard } from "@/components/ui/property-photo-card";
import { HistogramRangeSlider } from "@/components/ui/histogram-range-slider";
import { StickyActionBar } from "@/components/ui/sticky-action-bar";
import { AmenityColumn, ThumbStrip } from "@/components/ui/thumb-strip";
import { CoverFallback } from "@/components/ui/cover-fallback";
import { Wizard } from "@/components/ui/wizard";
import { GreetingHeader } from "@/components/ui/greeting-header";
import * as Illustrations from "@/components/illustrations";
import { PHOTOS } from "@/config/generated-assets";
import { formatKWD } from "@/domain/money";
import {
  PERIOD_STATUSES,
  UNIT_STATUSES,
  CONTRACT_STATUSES,
  type PeriodStatus,
} from "@/domain/types";
import { PERIOD_STATUS_STYLE } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { ColumnDef } from "@tanstack/react-table";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-[20px] font-semibold">{title}</h2>
      {children}
    </section>
  );
}

const RENTS = Array.from({ length: 160 }, (_, i) => 250_000 + ((i * 7919) % 97) * 7_000);
type Row = { unit: string; tenant: string; rent: number; status: PeriodStatus };
const ROWS: Row[] = ["1", "2", "3", "4", "5"].map((u, i) => ({
  unit: u,
  tenant: ["خالد", "فهد", "سالم", "ناصر", "بدر"][i]!,
  rent: 300_000 + i * 10_000,
  status: PERIOD_STATUSES[i]!,
}));

export function Gallery() {
  const locale = useLocale() as "ar" | "en";
  const [dark, setDark] = useState(false);
  const [dir, setDir] = useState<"rtl" | "ltr">(locale === "ar" ? "rtl" : "ltr");
  const [seg, setSeg] = useState<string>("any");
  const [on, setOn] = useState(true);
  const [step, setStep] = useState(2);
  const [chip, setChip] = useState("apartment");
  const [q, setQ] = useState("");
  const [money, setMoney] = useState<number | null>(195000);
  const [date, setDate] = useState<string | null>("2026-10-01");
  const [month, setMonth] = useState("2026-08");
  const [sheet, setSheet] = useState(false);
  const [alert, setAlert] = useState(false);
  const [range, setRange] = useState<[number, number]>([300_000, 700_000]);
  const [counter, setCounter] = useState(8_890_000);
  const [wizStep, setWizStep] = useState(0);
  const [pinned, setPinned] = useState(false);
  const fmt = (f: number) => formatKWD(f, { locale, showCurrency: false });
  const columns: ColumnDef<Row, unknown>[] = [
    { accessorKey: "unit", header: "Unit" },
    { accessorKey: "tenant", header: "Tenant" },
    {
      accessorKey: "rent",
      header: "Rent",
      cell: (c) => fmt(c.getValue() as number),
      meta: { numeric: true, footer: fmt(ROWS.reduce((a, r) => a + r.rent, 0)) },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: (c) => <PeriodStatusPill status={c.getValue() as PeriodStatus} />,
    },
  ];

  return (
    <div className={cn(dark && "dark")}>
      <div dir={dir} className="bg-bg text-label space-y-10 rounded-[32px] p-4 py-8 lg:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-[34px] font-bold">Design system</h1>
          <div className="flex gap-2">
            <SegmentedControl
              fill={false}
              size="sm"
              options={[
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
              ]}
              value={dark ? "dark" : "light"}
              onChange={(v) => setDark(v === "dark")}
            />
            <SegmentedControl
              fill={false}
              size="sm"
              options={[
                { value: "rtl", label: "RTL" },
                { value: "ltr", label: "LTR" },
              ]}
              value={dir}
              onChange={(v) => setDir(v as "rtl" | "ltr")}
            />
          </div>
        </div>

        <Section title="GreetingHeader">
          <GreetingHeader
            name="وائل"
            org="مكتب الواحة لإدارة العقارات"
            greeting="مرحبًا، وائل"
            trailing={
              <GlassButton className="bg-paper text-label">
                <Heart />
              </GlassButton>
            }
          />
        </Section>

        <Section title="Buttons">
          <div className="flex flex-wrap gap-3">
            <Button size="lg">سجّل دفعة</Button>
            <Button variant="secondary">اطبع الكشف</Button>
            <Button variant="tinted">Tinted</Button>
            <Button variant="rose">سجّل دفعة</Button>
            <Button variant="destructive">إلغاء القيد</Button>
            <Button variant="plain">عرض الكل</Button>
            <Button loading>Loading</Button>
            <Button disabled>Disabled</Button>
            <Button size="icon" variant="secondary" aria-label="share">
              <Share2 />
            </Button>
          </div>
        </Section>

        <Section title="Photo hero · Glass · PropertyPhotoCard · CoverFallback">
          <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
            <PhotoHero
              src={PHOTOS["building-2"].src}
              name="الجابرية 157"
              alt="الجابرية 157"
              location="الجابرية، قطعة 1"
              title="الجابرية 157"
              topStart={
                <GlassButton aria-label="back">
                  <ChevronRight className="rotate-180 rtl:rotate-0" />
                </GlassButton>
              }
              topEnd={
                <GlassButton aria-label="share">
                  <Share2 />
                </GlassButton>
              }
              pills={
                <>
                  <GlassPill>٢٩ وحدة</GlassPill>
                  <GlassPill>٩٦٪ محصل</GlassPill>
                  <GlassPill tone="danger">٧٠٫٠٠٠ د.ك متأخرات</GlassPill>
                </>
              }
            />
            <PropertyPhotoCard
              LinkComponent={Link}
              href="/properties"
              name="السالمية 88"
              location="السالمية"
              photo={PHOTOS["building-3"].src}
              ctaLabel="عرض تفاصيل العقار"
              pinned={pinned}
              onTogglePin={() => setPinned((p) => !p)}
              pinLabel="pin"
              pills={
                <>
                  <GlassPill>١٠٠٪</GlassPill>
                  <GlassPill>٧٬٥٨٥ د.ك</GlassPill>
                </>
              }
            />
          </div>
          <div className="grid grid-cols-3 gap-3 lg:grid-cols-6">
            {[
              "الجابرية 157",
              "الري قسيمة 1674",
              "صباح السالم",
              "Salmiya 88",
              "Hawally",
              "Fintas",
            ].map((n) => (
              <div key={n} className="aspect-[4/5] overflow-hidden rounded-[20px]">
                <CoverFallback name={n} />
              </div>
            ))}
          </div>
        </Section>

        <Section title="Chips · Segmented · Toggle · Stepper">
          <ChipScroller>
            {[
              ["apartment", Building2, "شقة"],
              ["shop", Store, "محل"],
              ["office", Layers, "مكتب"],
              ["warehouse", Warehouse, "مخزن"],
            ].map(([k, Icon, l]) => {
              const I = Icon as typeof Building2;
              return (
                <IconChip
                  key={k as string}
                  icon={<I />}
                  active={chip === k}
                  onClick={() => setChip(k as string)}
                >
                  {l as string}
                </IconChip>
              );
            })}
          </ChipScroller>
          <div className="flex flex-wrap gap-2">
            <Chip active>هذا الشهر</Chip>
            <Chip>الربع الحالي</Chip>
            <Chip>هذه السنة</Chip>
          </div>
          <SegmentedControl
            options={["any", "1", "2", "3", "4+"].map((v) => ({
              value: v,
              label: v === "any" ? "الكل" : v,
            }))}
            value={seg}
            onChange={setSeg}
          />
          <div className="flex items-center gap-6">
            <Toggle checked={on} onCheckedChange={setOn} ariaLabel="toggle" />
            <Stepper
              value={step}
              onChange={setStep}
              labels={{ decrement: "-", increment: "+" }}
              format={(v) => `${v}`}
            />
          </div>
        </Section>

        <Section title="Status pills">
          <div className="flex flex-wrap gap-2">
            {PERIOD_STATUSES.map((s) => (
              <PeriodStatusPill key={s} status={s} />
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {UNIT_STATUSES.map((s) => (
              <UnitStatusPill key={s} status={s} />
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {CONTRACT_STATUSES.map((s) => (
              <ContractStatusPill key={s} status={s} />
            ))}
          </div>
        </Section>

        <Section title="Inputs">
          <div className="grid gap-4 md:grid-cols-2">
            <SearchField value={q} onValueChange={setQ} placeholder="ابحث" />
            <Field label="الاسم" htmlFor="g-name">
              <Input id="g-name" placeholder="خالد" />
            </Field>
            <Field label="المبلغ" htmlFor="g-money">
              <MoneyInput id="g-money" value={money} onChange={setMoney} />
            </Field>
            <Field label="الهاتف" htmlFor="g-phone">
              <PhoneInput id="g-phone" placeholder="5512 3456" />
            </Field>
            <Field label="الرقم المدني" htmlFor="g-cid" warning="خانة التحقق لا تطابق">
              <CivilIdInput id="g-cid" defaultValue="285010112359" />
            </Field>
            <Field label="التاريخ" htmlFor="g-date">
              <DatePicker id="g-date" value={date} onChange={setDate} />
            </Field>
            <Field label="النوع" htmlFor="g-select">
              <Select id="g-select">
                <option>سكني</option>
                <option>استثماري</option>
              </Select>
            </Field>
            <Field label="ملاحظات" htmlFor="g-notes">
              <Textarea id="g-notes" />
            </Field>
          </div>
          <MonthPicker value={month} onChange={setMonth} />
        </Section>

        <Section title="Histogram range slider">
          <Card className="p-5">
            <HistogramRangeSlider
              values={RENTS}
              min={250_000}
              max={930_000}
              step={5_000}
              value={range}
              onChange={setRange}
              format={(v) => formatKWD(v, { locale, showCurrency: false })}
              labels={{ min: "min", max: "max" }}
            />
          </Card>
        </Section>

        <Section title="Grouped list">
          <GroupedList>
            <GroupedSection header="الإعدادات" footer="Footer caption">
              <ListRow
                leading={
                  <IconTile tone="green">
                    <HandCoins />
                  </IconTile>
                }
                title="التحصيل"
                subtitle="أغسطس 2026"
                trailing="8,890.000"
                chevron
                onClick={() => toast("tap")}
              />
              <ListRow
                leading={
                  <IconTile tone="orange">
                    <Wallet />
                  </IconTile>
                }
                title="المصروفات"
                trailing={<Toggle checked={on} onCheckedChange={setOn} ariaLabel="t" />}
              />
              <ListRow title="حذف" destructive onClick={() => setAlert(true)} />
            </GroupedSection>
          </GroupedList>
        </Section>

        <Section title="Cards · Charts">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card className="p-5">
              <CardHeader className="p-0" title="تحصيل هذا الشهر" />
              <div className="mt-4 flex justify-center">
                <ProgressRing value={0.992} celebrate label="99%">
                  <div>
                    <div className="num text-[26px] font-semibold">99٪</div>
                  </div>
                </ProgressRing>
              </div>
            </Card>
            <Card className="space-y-4 p-5">
              <RollingNumber
                value={counter}
                format={(n) => formatKWD(n, { locale })}
                className="num block text-[34px] font-semibold"
              />
              <Button size="sm" variant="tinted" onClick={() => setCounter((c) => c + 320_000)}>
                +320
              </Button>
              <Meter
                segments={[
                  { value: 0.7, color: "var(--green)" },
                  { value: 0.1, color: "var(--orange)" },
                ]}
              />
              <Sparkline data={[3, 5, 4, 6, 7, 6, 8, 9]} />
            </Card>
            <Card className="p-5">
              <BarMini
                items={[
                  { label: "0–30", value: 20, color: "var(--orange)" },
                  { label: "31–60", value: 50, color: "var(--orange)" },
                  { label: "61–90", value: 0, color: "var(--red)" },
                  { label: "90+", value: 135, color: "var(--red)" },
                ]}
              />
            </Card>
            <Card className="grid place-items-center p-5">
              <Donut
                segments={[
                  { value: 37, color: "var(--green)" },
                  { value: 11, color: "var(--gray)" },
                  { value: 1, color: "var(--teal)" },
                ]}
              >
                <span className="num text-[18px] font-semibold">78٪</span>
              </Donut>
            </Card>
          </div>
          <Card className="p-5">
            <Heatmap
              rows={["1", "2", "9", "20", "السطح"]}
              columns={["03", "04", "05", "06", "07", "08"]}
              rowLabel={(r) => r}
              columnLabel={(c) => c}
              cell={(r, ci) => {
                const s: PeriodStatus =
                  r === "السطح"
                    ? "vacant"
                    : r === "9" && ci === 5
                      ? "partial"
                      : r === "20" && ci === 5
                        ? "partial"
                        : ci === 0 && r === "2"
                          ? "advance"
                          : "paid";
                return <div className={cn("size-6 rounded-[6px]", PERIOD_STATUS_STYLE[s].cell)} />;
              }}
            />
          </Card>
        </Section>

        <Section title="Unit detail pieces">
          <Card className="grid gap-4 p-5 md:grid-cols-[auto_1fr]">
            <AmenityColumn
              items={[
                { icon: <BedDouble />, label: "غرف", value: "3" },
                { icon: <Bath />, label: "حمامات", value: "2" },
                { icon: <Ruler />, label: "المساحة", value: "150 م²" },
                { icon: <Gauge />, label: "عداد الكهرباء", value: "E-44120" },
              ]}
            />
            <ThumbStrip
              alt="unit"
              photos={[PHOTOS["hero-villa"], PHOTOS["building-1"], PHOTOS["hero-evening"]]}
            />
          </Card>
        </Section>

        <Section title="DataTable">
          <DataTable
            data={ROWS}
            columns={columns}
            showFooter
            selectable
            bulkBar={(rows, clear) => (
              <Button size="sm" variant="white" onClick={clear}>
                {rows.length}
              </Button>
            )}
            maxHeight="none"
          />
        </Section>

        <Section title="Wizard">
          <Card className="p-5">
            <Wizard
              steps={["النوع", "الأطراف", "العقار", "الشروط"]}
              current={wizStep}
              onBack={() => setWizStep((s) => Math.max(0, s - 1))}
              onNext={() => setWizStep((s) => Math.min(3, s + 1))}
              onSaveDraft={() => toast.success("saved")}
            >
              <div className="text-label-2 py-10 text-center">Step {wizStep + 1}</div>
            </Wizard>
          </Card>
        </Section>

        <Section title="Sheet · Dialog · Menu · Toast · Spinner · Skeleton">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" onClick={() => setSheet(true)}>
              Sheet
            </Button>
            <Button variant="secondary" onClick={() => setAlert(true)}>
              Alert
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary">Menu</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem>تعديل</DropdownMenuItem>
                <DropdownMenuItem destructive>حذف</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="secondary"
              onClick={() =>
                toast.success("تم تسجيل الدفعة", {
                  description: "300.000 د.ك — وحدة 5",
                  action: { label: "اطبع الإيصال", onClick: () => {} },
                })
              }
            >
              Toast
            </Button>
            <Spinner />
          </div>
          <Card className="space-y-3 p-5">
            <Skeleton className="h-8 w-40" />
            <SkeletonText />
          </Card>
          <Sheet
            open={sheet}
            onOpenChange={setSheet}
            title="سجّل دفعة"
            footer={
              <Button block size="lg" onClick={() => setSheet(false)}>
                حفظ
              </Button>
            }
          >
            <Field label="المبلغ" htmlFor="s-money">
              <MoneyInput id="s-money" value={money} onChange={setMoney} size="lg" />
            </Field>
          </Sheet>
          <AlertDialog
            open={alert}
            onOpenChange={setAlert}
            title="إلغاء القيد؟"
            description="سيتم إلغاء الدفعة وإزالة تخصيصها."
            confirmLabel="إلغاء القيد"
            cancelLabel="رجوع"
            destructive
            onConfirm={() => setAlert(false)}
          />
        </Section>

        <Section title="Empty states & illustrations">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            {Object.entries(Illustrations).map(([name, C]) => (
              <Card key={name} className="p-4">
                <div className="text-label mx-auto w-28">
                  <C />
                </div>
                <div className="text-label-2 mt-2 truncate text-center text-[11px]">{name}</div>
              </Card>
            ))}
          </div>
          <Card>
            <EmptyState
              illustration={<Illustrations.NoLateUnitsIllustration />}
              title="لا توجد وحدات متأخرة هذا الشهر. عمل رائع."
              action={<Button>عرض التقارير</Button>}
            />
          </Card>
        </Section>

        <Section title="StickyActionBar">
          <StickyActionBar
            className="lg:static"
            figure="300.000 د.ك"
            caption="/شهريًا"
            action={
              <Button variant="rose" size="lg">
                سجّل دفعة
              </Button>
            }
          />
        </Section>
      </div>
    </div>
  );
}
