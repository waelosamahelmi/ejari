# Kuwait Address + Unit Planner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Kuwait governorate→area address selector and an explicit floor-by-floor unit planner, and wire both into property creation/edit and bulk unit adding, without duplicating existing models.

**Architecture:** One additive migration adds `properties.governorate`. A local, versioned Kuwait address dataset (`src/data/kuwait-addresses.ts`) provides governorate/area options and label resolution with legacy fallback. A pure generator (`src/domain/unit-plan.ts`) turns explicit floor rows into `units` rows deterministically (no redistribution). Two server actions create planned units and create a property with its plan (with compensating cleanup). The existing `PropertyFormSheet` becomes a 2-step create flow; the existing `BulkUnitsSheet` reuses the same `UnitPlanner`. Display/search resolve localized labels from the dataset.

**Tech Stack:** Next.js 15 / React 19, TypeScript strict, Tailwind v4, zod v4, react-hook-form, next-intl (ar default / en), Supabase (Postgres + RLS), Vitest, Playwright.

## Global Constraints

- Package manager: **pnpm**. Quality gate after every task: `pnpm typecheck && pnpm lint && pnpm test` (full gate incl. `pnpm build` at the end).
- **Do not edit old migrations.** New file: `supabase/migrations/20261003000001_property_governorate.sql`.
- Do **not** add `units_count`, a `floors` table, `property_units`, a second expense architecture, or a new `commercial` property type. `investment` = commercial.
- Bilingual: every UI string in `src/messages/ar/*` **and** `src/messages/en/*` (ICU args must match; `tests/unit/i18n.test.ts` enforces). No hard-coded UI text.
- RTL: logical properties only (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`). Reuse existing `Field`, `Select`, `Input`, `MoneyInput`, `Sheet`, `Chip`, `Wizard`, `SegmentedControl`, `Button` primitives.
- No `@ts-ignore`, no disabled tests, no service-role shortcuts, no TODO stubs. Zod-validate all server input; require `manage_master_data` for master-data writes.
- DB stays nullable for `governorate`; the app schema requires governorate + area for new/edited properties.
- Stored `area` and `governorate` values are canonical Arabic names (see Task 2); contracts/statements print Arabic and read `properties.area` directly.
- Local Supabase is running (`npx supabase status`): use `npx supabase migration up --local` and `pnpm db:types`; full `pnpm db:reset` in the final task.
- Do not commit `AGENTS.md`, `CLAUDE.md`, or `.DS_Store`; stage files explicitly. Existing commit style: `feat(scope): ...`, `refactor(...)`, `test(...)`, `chore: ...`.

---

### Task 1: Migration, types, seed governorate, Purchase category

**Files:**
- Create: `supabase/migrations/20261003000001_property_governorate.sql`
- Modify: `supabase/seed.sql` (properties insert ~line 150; expense categories ~line 1765)
- Regenerate: `src/lib/supabase/types.ts`
- Modify: `src/server/actions/auth.ts:171-182` (`DEFAULT_CATEGORIES`)

**Interfaces:**
- Produces: `properties.governorate text | null` available in generated types as `"governorate": string | null` in Row/Insert/Update of `properties`.

- [ ] **Step 1: Write the migration**

```sql
-- Kuwait address: governorate (المحافظة). Nullable for legacy rows; the app
-- schema requires it for newly created/edited properties.
alter table public.properties
  add column if not exists governorate text;
```

- [ ] **Step 2: Apply locally and regenerate types**

```bash
npx supabase migration up --local
pnpm db:types
```

Verify `src/lib/supabase/types.ts` now contains `"governorate"` inside the `properties` Row/Insert/Update lines. If Supabase is unreachable, hand-edit those three lines to add `"governorate": string | null` (Row) / `"governorate"?: string | null` (Insert/Update) in the same compact format and note it in `docs/DECISIONS.md`.

- [ ] **Step 3: Seed governorates and the Purchase category**

In `supabase/seed.sql`, change the properties insert to include `governorate`:

```sql
insert into public.properties (id, org_id, name, name_en, area, governorate, block, street, avenue, house_or_plot, paci_no, property_type, floors, cover_image_path) values
  ('0d000000-0000-4000-8000-000000000001', '0a000000-0000-4000-8000-000000000001', 'الجابرية 157', 'Jabriya 157', 'الجابرية', 'حولي', '1', '7', null, '157', '12045781', 'mixed', 7, '/brand/photos/building-2.jpg'),
  ('0d000000-0000-4000-8000-000000000002', '0a000000-0000-4000-8000-000000000001', 'الري قسيمة 1674', 'Al-Rai Plot 1674', 'الري', 'الفروانية', '1', '22', null, '1674', '30498812', 'industrial', 2, '/brand/photos/building-4.jpg'),
  ('0d000000-0000-4000-8000-000000000003', '0a000000-0000-4000-8000-000000000001', 'صباح السالم قطعة 12 منزل 43', 'Sabah Al-Salem B12 H43', 'صباح السالم', 'مبارك الكبير', '12', '5', '3', '43', '18834506', 'residential', 3, '/brand/photos/building-1.jpg'),
  ('0d000000-0000-4000-8000-000000000004', '0a000000-0000-4000-8000-000000000001', 'السالمية 88', 'Salmiya 88', 'السالمية', 'حولي', '10', 'حمد المبارك', null, '88', '15520937', 'residential', 5, '/brand/photos/building-3.jpg');
```

In the same file's `insert into public.expense_categories`, add one row:

```sql
  ('1d000000-0000-4000-8000-000000000011', '0a000000-0000-4000-8000-000000000001', 'شراء', 'Purchase', 'capital'),
```

(`تأمين`/Insurance already exists as `1d000000-...-0009`; leave it.)

In `src/server/actions/auth.ts`, update `DEFAULT_CATEGORIES` (type and array):

```ts
const DEFAULT_CATEGORIES: [string, string, "operating" | "payroll" | "capital"][] = [
  ["راتب شهري", "Monthly salary", "payroll"],
  ["مصاريف صيانة", "Maintenance", "operating"],
  ["وقود وسيارات", "Fuel & vehicles", "operating"],
  ["كهرباء وماء", "Electricity & water", "operating"],
  ["نظافة", "Cleaning", "operating"],
  ["رسوم حكومية", "Government fees", "operating"],
  ["قرطاسية وتصوير", "Stationery & copies", "operating"],
  ["عمولات", "Commissions", "operating"],
  ["تأمين", "Insurance", "operating"],
  ["شراء", "Purchase", "capital"],
  ["أخرى", "Other", "operating"],
];
```

- [ ] **Step 4: Verify**

```bash
pnpm typecheck && pnpm lint && pnpm test
```

Expected: all green (no behavior changed yet).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20261003000001_property_governorate.sql supabase/seed.sql src/lib/supabase/types.ts src/server/actions/auth.ts
git commit -m "feat(db): property governorate column and purchase category"
```

---

### Task 2: Kuwait governorate + area dataset with helpers (TDD)

**Files:**
- Create: `src/data/kuwait-addresses.ts`
- Test: `tests/unit/kuwait-addresses.test.ts`

**Interfaces:**
- Produces: `KuwaitArea { value; ar; en }`, `KuwaitGovernorate { value; ar; en; areas }`, `KUWAIT_GOVERNORATES`, `OTHER_AREA`, `AddressLocale = "ar" | "en"`, `findGovernorate(value)`, `findArea(value, governorate?)`, `areaBelongsTo(areaValue, governorateValue)`, `areaAfterGovernorateChange(area, governorate)`, `governorateLabel(value, locale)`, `areaLabel(value, locale, governorate?)`, `locationLabel(governorate, area, locale)`.
- Stored values are the canonical **Arabic** names for both governorate and area (legacy-compatible and printed in Arabic contracts). `en` is the display translation.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/kuwait-addresses.test.ts
import { describe, expect, it } from "vitest";
import {
  KUWAIT_GOVERNORATES,
  OTHER_AREA,
  areaAfterGovernorateChange,
  areaBelongsTo,
  areaLabel,
  findArea,
  findGovernorate,
  governorateLabel,
  locationLabel,
} from "@/data/kuwait-addresses";

describe("Kuwait address dataset", () => {
  it("has all six governorates with unique values and bilingual labels", () => {
    expect(KUWAIT_GOVERNORATES.map((g) => g.value)).toEqual([
      "العاصمة",
      "حولي",
      "الفروانية",
      "الأحمدي",
      "الجهراء",
      "مبارك الكبير",
    ]);
    for (const g of KUWAIT_GOVERNORATES) {
      expect(g.ar.trim()).not.toBe("");
      expect(g.en.trim()).not.toBe("");
      expect(g.value).toBe(g.ar);
      expect(g.areas.length).toBeGreaterThan(3);
      const values = g.areas.map((a) => a.value);
      expect(new Set(values).size).toBe(values.length);
      for (const a of g.areas) {
        expect(a.value.trim()).not.toBe("");
        expect(a.ar.trim()).not.toBe("");
        expect(a.en.trim()).not.toBe("");
        expect(a.value).toBe(a.ar);
      }
    }
  });

  it("resolves labels and falls back to raw legacy values", () => {
    expect(findGovernorate("حولي")?.en).toBe("Hawalli");
    expect(findArea("السالمية", "حولي")?.en).toBe("Salmiya");
    expect(governorateLabel("حولي", "en")).toBe("Hawalli");
    expect(areaLabel("السالمية", "en", "حولي")).toBe("Salmiya");
    expect(areaLabel("منطقة قديمة", "en")).toBe("منطقة قديمة");
    expect(areaLabel("منطقة قديمة", "ar")).toBe("منطقة قديمة");
    expect(areaLabel(null, "en")).toBe("");
    expect(governorateLabel(null, "ar")).toBe("");
    expect(areaLabel("أخرى", "en")).toBe(OTHER_AREA.en);
  });

  it("keeps ambiguous area names within their governorate", () => {
    expect(areaBelongsTo("النهضة", "الجهراء")).toBe(true);
    expect(areaBelongsTo("النهضة", "العاصمة")).toBe(true);
    expect(areaBelongsTo("النهضة", "حولي")).toBe(false);
    expect(areaLabel("النهضة", "en", "الجهراء")).toBe("Al-Nahda");
    expect(areaLabel("النهضة", "en", "العاصمة")).toBe("Nahdha");
  });

  it("clears the area on governorate change only when it cannot belong", () => {
    expect(areaAfterGovernorateChange("السالمية", "الفروانية")).toBe("");
    expect(areaAfterGovernorateChange("السالمية", "حولي")).toBe("السالمية");
    expect(areaAfterGovernorateChange("منطقة قديمة", "حولي")).toBe("منطقة قديمة");
    expect(areaAfterGovernorateChange("النهضة", "الجهراء")).toBe("النهضة");
    expect(areaAfterGovernorateChange("", "حولي")).toBe("");
  });

  it("formats a card location", () => {
    expect(locationLabel("حولي", "السالمية", "ar")).toBe("حولي · السالمية");
    expect(locationLabel("حولي", "السالمية", "en")).toBe("Hawalli · Salmiya");
    expect(locationLabel(null, "السالمية", "en")).toBe("Salmiya");
    expect(locationLabel(null, null, "en")).toBe("");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test tests/unit/kuwait-addresses.test.ts`
Expected: FAIL — cannot resolve `@/data/kuwait-addresses`.

- [ ] **Step 3: Write the dataset**

Create `src/data/kuwait-addresses.ts` with the full list below. The `value`/`ar` are the canonical Arabic name; `en` is the official English name.

```ts
/**
 * Kuwait governorates and areas.
 * Source: PACI Statistical Reports / "Areas of Kuwait" (en.wikipedia.org/wiki/Areas_of_Kuwait,
 * revision 2026-09-27), which cites the Central Statistical Bureau Geoportal (gis.csb.gov.kw).
 * Values are canonical Arabic names stored in the database and printed in Arabic documents.
 * Reviewed 2026-10-03. Update this file when PACI publishes new areas.
 */
export type AddressLocale = "ar" | "en";

export interface KuwaitArea {
  value: string;
  ar: string;
  en: string;
}

export interface KuwaitGovernorate {
  value: string;
  ar: string;
  en: string;
  areas: KuwaitArea[];
}

const a = (value: string, en: string): KuwaitArea => ({ value, ar: value, en });

export const OTHER_AREA: KuwaitArea = a("أخرى", "Other");

export const KUWAIT_GOVERNORATES: KuwaitGovernorate[] = [
  {
    value: "العاصمة",
    ar: "العاصمة",
    en: "Capital",
    areas: [
      a("ضاحية عبدالله السالم", "Abdullah Al-Salem"),
      a("العديلية", "Adailiya"),
      a("حدائق السور", "Al-Sour Gardens"),
      a("بنيد القار", "Bneid Al-Gar"),
      a("الدعية", "Daiya"),
      a("الدسمة", "Dasma"),
      a("الدوحة", "Doha"),
      a("ميناء الدوحة", "Doha Port"),
      a("الفيحاء", "Faiha"),
      a("فيلكا", "Failaka Island"),
      a("غرناطة", "Granada"),
      a("جبلة", "Jibla"),
      a("كيفان", "Kaifan"),
      a("الخالدية", "Khaldiya"),
      a("المنصورية", "Mansouriya"),
      a("المرقاب", "Mirqab"),
      a("النهضة", "Nahdha"),
      a("شمال غرب الصليبيخات", "North West Sulaibikhat"),
      a("النزهة", "Nuzha"),
      a("القادسية", "Qadsiya"),
      a("قرطبة", "Qortuba"),
      a("الروضة", "Rawda"),
      a("الشامية", "Shamiya"),
      a("شرق", "Sharq"),
      a("الشويخ", "Shuwaikh"),
      a("الشويخ الصناعية", "Shuwaikh Industrial Area"),
      a("ميناء الشويخ", "Shuwaikh Port"),
      a("الصليبخات", "Sulaibikhat"),
      a("القيروان", "Qairawan"),
      a("السرة", "Surra"),
      a("جزيرة عوهة", "Ouha Island"),
      a("جزيرة مسكان", "Miskan Island"),
      a("جزيرة أم النمل", "Umm an Namil Island"),
      a("اليرموك", "Yarmouk"),
    ],
  },
  {
    value: "حولي",
    ar: "حولي",
    en: "Hawalli",
    areas: [
      a("بيان", "Bayan"),
      a("الجابرية", "Jabriya"),
      a("الرميثية", "Rumaithiya"),
      a("سلام", "Salam"),
      a("سلوى", "Salwa"),
      a("البدع", "Al-Bida'a"),
      a("أنجفة", "Anjafa"),
      a("حولي", "Hawally"),
      a("حطين", "Hitteen"),
      a("مشرف", "Mishrif"),
      a("مبارك العبدالله", "Mubarak Al-Abdullah"),
      a("السالمية", "Salmiya"),
      a("الشعب", "Shaab"),
      a("الشهداء", "Shuhada"),
      a("الصديق", "Al-Siddiq"),
      a("منطقة الوزارات", "Ministries Area"),
      a("الزهراء", "Zahra"),
    ],
  },
  {
    value: "الفروانية",
    ar: "الفروانية",
    en: "Farwaniya",
    areas: [
      a("عبدالله المبارك", "Abdullah Al-Mubarak"),
      a("منطقة المطار", "Airport District"),
      a("الأندلس", "Andalus"),
      a("العارضية", "Ardiya"),
      a("العارضية حرفية", "Ardiya Herafiya"),
      a("اشبيلية", "Ishbiliya"),
      a("الضجيج", "Al-Dajeej"),
      a("الفروانية", "Farwaniya"),
      a("الفردوس", "Ferdous"),
      a("جليب الشيوخ", "Jleeb Al-Shuyoukh"),
      a("خيطان", "Khaitan"),
      a("العمرية", "Omariya"),
      a("الرابية", "Rabiya"),
      a("الري", "Al-Rai"),
      a("الرقعي", "Al-Riggai"),
      a("الرحاب", "Rehab"),
      a("صباح الناصر", "Sabah Al-Nasser"),
      a("جامعة صباح السالم", "Sabah Al-Salem University"),
      a("غرب عبدالله المبارك", "West Abdullah Al-Mubarak"),
      a("جنوب عبدالله المبارك", "South Abdullah Al-Mubarak"),
      a("الصليبية الصناعية", "Sulaibiya Industrial"),
    ],
  },
  {
    value: "الأحمدي",
    ar: "الأحمدي",
    en: "Ahmadi",
    areas: [
      a("أبو حليفة", "Abu Halifa"),
      a("ميناء عبدالله", "Mina Abdulla"),
      a("الأحمدي", "Ahmadi"),
      a("علي صباح السالم", "Ali Sabah Al-Salem"),
      a("العقيلة", "Egaila"),
      a("بر الأحمدي", "Bar Al-Ahmadi"),
      a("بنيدر", "Bnaider"),
      a("الظهر", "Dhaher"),
      a("الفحيحيل", "Fahaheel"),
      a("فهد الأحمد", "Fahad Al-Ahmad"),
      a("هدية", "Hadiya"),
      a("جابر العلي", "Jaber Al-Ali"),
      a("الجليعة", "Al-Julaia'a"),
      a("الخيران", "Khairan"),
      a("المهبولة", "Mahboula"),
      a("المنقف", "Mangaf"),
      a("المقوع", "Magwa"),
      a("وفرة السكنية", "Wafra Residential"),
      a("النويصيب", "Al-Nuwaiseeb"),
      a("الرقة", "Riqqa"),
      a("صباح الأحمد", "Sabah Al Ahmad"),
      a("مدينة صباح الأحمد البحرية", "Sabah Al Ahmad Sea City"),
      a("الصباحية", "Sabahiya"),
      a("الشعيبة", "Shuaiba Industrial"),
      a("جنوب الصباحية", "South Sabahiya"),
      a("الوفرة", "Wafra"),
      a("الزور", "Zoor"),
      a("الفنطاس", "Fintas"),
      a("الشدادية الصناعية", "Al Shadadiya Industrial"),
    ],
  },
  {
    value: "الجهراء",
    ar: "الجهراء",
    en: "Jahra",
    areas: [
      a("العبدلي", "Abdali"),
      a("المطلاع", "Al-Mutlaa"),
      a("كاظمة", "Kazma"),
      a("بحرة", "Bahra"),
      a("كبد", "Kabd"),
      a("الشقايه", "Al-Sheqaya"),
      a("النهضة", "Al-Nahda"),
      a("أمغرة", "Amghara Industrial"),
      a("بر الجهراء", "Bar Al-Jahra"),
      a("الجهراء", "Jahra"),
      a("الجهراء الصناعية الحرفية", "Jahra Industrial Herafiya"),
      a("النعيم", "Naeem"),
      a("النسيم", "Nasseem"),
      a("العيون", "Oyoun"),
      a("القصر", "Qasr"),
      a("جابر الأحمد", "Jaber Al-Ahmad"),
      a("سعد العبدالله", "Saad Al Abdullah"),
      a("السالمي", "Salmi"),
      a("الصبية", "Subiya"),
      a("الصليبية", "Sulaibiya"),
      a("الصليبية الزراعية", "Sulaibiya Agricultural Area"),
      a("الصليبية السكنية", "Sulaibiya Residential"),
      a("تيماء", "Taima"),
      a("الواحة", "Waha"),
      a("جزيرة بوبيان", "Bubiyan Island"),
      a("جزيرة وربة", "Warbah Island"),
    ],
  },
  {
    value: "مبارك الكبير",
    ar: "مبارك الكبير",
    en: "Mubarak Al-Kabeer",
    areas: [
      a("أبو الحصانية", "Abu Al Hasaniya"),
      a("أبو فطيرة", "Abu Ftaira"),
      a("العدان", "Al-Adan"),
      a("القرين", "Al Qurain"),
      a("القصور", "Al-Qusour"),
      a("الفنيطيس", "Al-Fnaitees"),
      a("المسيلة", "Messila"),
      a("المسايل", "Al-Masayel"),
      a("مبارك الكبير", "Mubarak Al-Kabeer"),
      a("صباح السالم", "Sabah Al-Salem"),
      a("صبحان", "Subhan Industrial"),
      a("الوسطى", "Wista"),
      a("غرب أبو فطيرة حرفية", "West Abu Ftaira Herafiya"),
    ],
  },
];

export function findGovernorate(value: string | null | undefined): KuwaitGovernorate | undefined {
  if (!value) return undefined;
  return KUWAIT_GOVERNORATES.find((g) => g.value === value);
}

export function findArea(
  value: string | null | undefined,
  governorate?: string | null,
): KuwaitArea | undefined {
  if (!value) return undefined;
  const inGov = findGovernorate(governorate)?.areas.find((area) => area.value === value);
  if (inGov) return inGov;
  for (const g of KUWAIT_GOVERNORATES) {
    const area = g.areas.find((x) => x.value === value);
    if (area) return area;
  }
  return value === OTHER_AREA.value ? OTHER_AREA : undefined;
}

export function areaBelongsTo(
  areaValue: string | null | undefined,
  governorateValue: string | null | undefined,
): boolean {
  if (!areaValue || !governorateValue) return false;
  if (areaValue === OTHER_AREA.value) return true;
  return !!findGovernorate(governorateValue)?.areas.some((area) => area.value === areaValue);
}

/** "" only when the area is a known area that does not belong to the new governorate. */
export function areaAfterGovernorateChange(
  area: string | null | undefined,
  governorate: string | null | undefined,
): string {
  if (!area) return "";
  if (!findArea(area)) return area;
  return areaBelongsTo(area, governorate) ? area : "";
}

export function governorateLabel(
  value: string | null | undefined,
  locale: AddressLocale,
): string {
  if (!value) return "";
  const g = findGovernorate(value);
  if (!g) return value;
  return locale === "en" ? g.en : g.ar;
}

export function areaLabel(
  value: string | null | undefined,
  locale: AddressLocale,
  governorate?: string | null,
): string {
  if (!value) return "";
  const area = findArea(value, governorate);
  if (!area) return value;
  return locale === "en" ? area.en : area.ar;
}

export function locationLabel(
  governorate: string | null | undefined,
  area: string | null | undefined,
  locale: AddressLocale,
): string {
  return [governorateLabel(governorate, locale), areaLabel(area, locale, governorate)]
    .filter(Boolean)
    .join(" · ");
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test tests/unit/kuwait-addresses.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/kuwait-addresses.ts tests/unit/kuwait-addresses.test.ts
git commit -m "feat(data): Kuwait governorate and area dataset"
```

---

### Task 3: Unit plan domain logic (TDD)

**Files:**
- Create: `src/domain/unit-plan.ts`
- Test: `tests/unit/unit-plan.test.ts`

**Interfaces:**
- Produces: `MAX_PLANNED_UNITS = 300`, `FLOOR_MIN = -5`, `FLOOR_MAX = 200`, `UnitPlanRow { floor; count; type; prefix; startNumber; askingRentFils; bedrooms; areaM2 }`, `PlannedUnit { label; type; floor; areaM2; bedrooms; bathrooms; askingRentFils }`, `UnitPlanIssue`, `planTotal(rows)`, `generatePlannedUnits(rows)`, `duplicateLabels(units, existing?)`, `planIssues(rows)`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/unit-plan.test.ts
import { describe, expect, it } from "vitest";
import {
  FLOOR_MAX,
  FLOOR_MIN,
  MAX_PLANNED_UNITS,
  duplicateLabels,
  generatePlannedUnits,
  planIssues,
  planTotal,
  type UnitPlanRow,
} from "@/domain/unit-plan";

const row = (over: Partial<UnitPlanRow>): UnitPlanRow => ({
  floor: 1,
  count: 4,
  type: "apartment",
  prefix: "",
  startNumber: 101,
  askingRentFils: 300_000,
  bedrooms: null,
  areaM2: null,
  ...over,
});

describe("unit plan", () => {
  it("generates exactly the requested count on each explicit floor", () => {
    const rows = [
      row({ floor: 0, count: 2, type: "shop", prefix: "S", startNumber: 1 }),
      row({ floor: 1, count: 4, startNumber: 101 }),
      row({ floor: 2, count: 3, startNumber: 201 }),
      row({ floor: 3, count: 5, startNumber: 301 }),
    ];
    const units = generatePlannedUnits(rows);
    expect(units).toHaveLength(14);
    expect(units.filter((u) => u.floor === 0)).toHaveLength(2);
    expect(units.filter((u) => u.floor === 1)).toHaveLength(4);
    expect(units.filter((u) => u.floor === 2)).toHaveLength(3);
    expect(units.filter((u) => u.floor === 3)).toHaveLength(5);
    expect(planTotal(rows)).toBe(14);
  });

  it("assigns every generated unit to its row's floor without redistribution", () => {
    const units = generatePlannedUnits([row({ floor: 1, count: 3 }), row({ floor: 3, count: 5 })]);
    expect(units.filter((u) => u.floor === 1)).toHaveLength(3);
    expect(units.filter((u) => u.floor === 3)).toHaveLength(5);
  });

  it("produces deterministic labels from prefix and start number", () => {
    const units = generatePlannedUnits([
      row({ floor: 0, count: 2, type: "shop", prefix: "S", startNumber: 1 }),
      row({ floor: 1, count: 2, prefix: "A-", startNumber: 101 }),
    ]);
    expect(units.map((u) => u.label)).toEqual(["S1", "S2", "A-101", "A-102"]);
    expect(units.map((u) => u.type)).toEqual(["shop", "shop", "apartment", "apartment"]);
  });

  it("preserves ground floor 0 and basements", () => {
    const units = generatePlannedUnits([
      row({ floor: 0, count: 1, prefix: "G", startNumber: 1 }),
      row({ floor: -1, count: 1, prefix: "B", startNumber: 1 }),
    ]);
    expect(units.map((u) => u.floor)).toEqual([0, -1]);
  });

  it("detects duplicate labels within the plan and against existing labels", () => {
    const dupWithin = generatePlannedUnits([row({ startNumber: 1, count: 2 }), row({ floor: 2, startNumber: 1, count: 1 })]);
    expect(duplicateLabels(dupWithin)).toEqual(["1"]);
    expect(duplicateLabels(generatePlannedUnits([row({ startNumber: 5, count: 1 })]), ["5"])).toEqual(["5"]);
    expect(duplicateLabels([{ label: "A1" }], [" a1 "])).toEqual(["A1"]);
    expect(duplicateLabels(generatePlannedUnits([row({ startNumber: 7, count: 1 })]), ["8"])).toEqual([]);
  });

  it("enforces the maximum unit count", () => {
    expect(planIssues([row({ count: MAX_PLANNED_UNITS })])).toEqual([]);
    expect(planIssues([row({ count: MAX_PLANNED_UNITS + 1 })])).toContainEqual({ code: "total" });
    expect(planTotal([row({ count: MAX_PLANNED_UNITS + 1 })])).toBe(MAX_PLANNED_UNITS + 1);
  });

  it("flags empty plans, bad counts and out-of-range floors", () => {
    expect(planIssues([])).toContainEqual({ code: "empty" });
    expect(planIssues([row({ count: 0 })])).toContainEqual({ code: "count", row: 0 });
    expect(planIssues([row({ floor: FLOOR_MIN - 1 })])).toContainEqual({ code: "floor", row: 0 });
    expect(planIssues([row({ floor: FLOOR_MAX + 1 })])).toContainEqual({ code: "floor", row: 0 });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test tests/unit/unit-plan.test.ts`
Expected: FAIL — cannot resolve `@/domain/unit-plan`.

- [ ] **Step 3: Implement the generator**

```ts
// src/domain/unit-plan.ts
import type { UnitType } from "./types";

export const MAX_PLANNED_UNITS = 300;
export const FLOOR_MIN = -5;
export const FLOOR_MAX = 200;

/** One "units per floor" row of the planner. */
export interface UnitPlanRow {
  floor: number;
  count: number;
  type: UnitType;
  prefix: string;
  startNumber: number;
  askingRentFils: number;
  bedrooms: number | null;
  areaM2: number | null;
}

/** The concrete unit that will be inserted. */
export interface PlannedUnit {
  label: string;
  type: UnitType;
  floor: number;
  areaM2: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  askingRentFils: number;
}

export type UnitPlanIssue =
  | { code: "empty" }
  | { code: "count"; row: number }
  | { code: "floor"; row: number }
  | { code: "total" };

export function planTotal(rows: readonly UnitPlanRow[]): number {
  return rows.reduce((n, r) => n + r.count, 0);
}

/** Deterministic: row order × (prefix + startNumber + index). Never redistributes floors. */
export function generatePlannedUnits(rows: readonly UnitPlanRow[]): PlannedUnit[] {
  const units: PlannedUnit[] = [];
  for (const row of rows) {
    const prefix = row.prefix.trim();
    for (let i = 0; i < row.count; i++) {
      units.push({
        label: `${prefix}${row.startNumber + i}`,
        type: row.type,
        floor: row.floor,
        areaM2: row.areaM2,
        bedrooms: row.bedrooms,
        bathrooms: null,
        askingRentFils: row.askingRentFils,
      });
    }
  }
  return units;
}

const norm = (s: string) => s.trim().toLowerCase();

/** Labels that collide with an earlier unit in the list or with existing units. */
export function duplicateLabels(
  units: readonly { label: string }[],
  existing: Iterable<string> = [],
): string[] {
  const seen = new Set<string>();
  for (const e of existing) seen.add(norm(e));
  const dupes: string[] = [];
  for (const u of units) {
    const label = u.label.trim();
    if (seen.has(norm(label)) && !dupes.includes(label)) dupes.push(label);
    seen.add(norm(label));
  }
  return dupes;
}

export function planIssues(rows: readonly UnitPlanRow[]): UnitPlanIssue[] {
  const issues: UnitPlanIssue[] = [];
  if (rows.length === 0 || planTotal(rows) === 0) issues.push({ code: "empty" });
  rows.forEach((r, i) => {
    if (!Number.isInteger(r.count) || r.count < 1) issues.push({ code: "count", row: i });
    if (!Number.isInteger(r.floor) || r.floor < FLOOR_MIN || r.floor > FLOOR_MAX)
      issues.push({ code: "floor", row: i });
  });
  if (planTotal(rows) > MAX_PLANNED_UNITS) issues.push({ code: "total" });
  return issues;
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test tests/unit/unit-plan.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/unit-plan.ts tests/unit/unit-plan.test.ts
git commit -m "feat(domain): deterministic unit plan generator"
```

---

### Task 4: Schemas — property address + planned units

**Files:**
- Modify: `src/lib/schemas/master.ts`
- Modify: `tests/unit/schemas.test.ts`

**Interfaces:**
- Consumes: `MAX_PLANNED_UNITS`, `FLOOR_MIN`, `FLOOR_MAX` from Task 3.
- Produces: `propertySchema` now requires `governorate: string` and `area: string`; `plannedUnitSchema`, `PlannedUnitInput`; `createPlannedUnitsSchema`, `CreatePlannedUnitsInput`; `createPropertyWithPlanSchema`, `CreatePropertyWithPlanInput`. `bulkUnitsSchema` stays until Task 7 deletes it.

- [ ] **Step 1: Update the test first**

In `tests/unit/schemas.test.ts`, update imports and the property test, and add planned-unit tests (leave the `bulkUnitsSchema` test in place for now — it is removed in Task 7):

```ts
import {
  bulkUnitsSchema,
  createPlannedUnitsSchema,
  ownerSchema,
  propertySchema,
  tenantSchema,
  unitSchema,
} from "@/lib/schemas/master";

// ...inside describe("master data schemas")
  it("property: owner shares must total 100, PACI is 8 digits, address is required", () => {
    const base = {
      name: "الجابرية 157",
      governorate: "حولي",
      area: "الجابرية",
      propertyType: "mixed" as const,
      owners: [{ ownerId: "0c000000-0000-4000-8000-000000000001", sharePct: 100 }],
    };
    expect(propertySchema.parse({ ...base, paciNo: "12045781" }).paciNo).toBe("12045781");
    expect(() => propertySchema.parse({ ...base, paciNo: "123" })).toThrow();
    expect(() => propertySchema.parse({ ...base, governorate: undefined })).toThrow();
    expect(() => propertySchema.parse({ ...base, area: "" })).toThrow();
    expect(() =>
      propertySchema.parse({
        ...base,
        owners: [{ ownerId: base.owners[0]!.ownerId, sharePct: 60 }],
      }),
    ).toThrow();
    expect(() => propertySchema.parse({ ...base, owners: [] })).toThrow();
  });

  it("planned units: bounds, duplicates and max count", () => {
    const pid = "0d000000-0000-4000-8000-000000000001";
    const unit = { label: "101", type: "apartment" as const, floor: 1, askingRentFils: 300000 };
    expect(createPlannedUnitsSchema.parse({ propertyId: pid, units: [unit] }).units).toHaveLength(1);
    expect(() => createPlannedUnitsSchema.parse({ propertyId: pid, units: [] })).toThrow();
    expect(() => createPlannedUnitsSchema.parse({ propertyId: pid, units: [unit, unit] })).toThrow();
    expect(() => createPlannedUnitsSchema.parse({ propertyId: "x", units: [unit] })).toThrow();
    expect(() =>
      createPlannedUnitsSchema.parse({
        propertyId: pid,
        units: Array.from({ length: 301 }, (_, i) => ({ ...unit, label: `u${i}` })),
      }),
    ).toThrow();
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test tests/unit/schemas.test.ts`
Expected: FAIL — `createPlannedUnitsSchema` is not exported / governorate behavior missing.

- [ ] **Step 3: Update `src/lib/schemas/master.ts`**

Add imports and the new schemas; make `governorate`/`area` required:

```ts
import { UNIT_TYPES } from "@/domain/types";
import { EXPENSE_CATEGORY_TYPES } from "@/domain/expenses";
import { FLOOR_MAX, FLOOR_MIN, MAX_PLANNED_UNITS } from "@/domain/unit-plan";
import { civilId, email, fils, iban, optText, paci, phones, req } from "./common";
```

In `propertySchema`, replace the two address lines:

```ts
    governorate: req(z.string().max(80, "tooLong")),
    area: req(z.string().max(120, "tooLong")),
```

Keep `nameEn`, `block`, `street`, `avenue`, `houseOrPlot` as `optText(...)` and `paci` unchanged. After `bulkUnitsSchema`, add:

```ts
export const plannedUnitSchema = z.object({
  label: req(z.string().max(60, "tooLong")),
  type: z.enum(UNIT_TYPES),
  floor: z
    .number()
    .int()
    .min(FLOOR_MIN)
    .max(FLOOR_MAX)
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  areaM2: z
    .number()
    .nonnegative()
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  bedrooms: z
    .number()
    .int()
    .min(0)
    .max(50)
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  bathrooms: z
    .number()
    .int()
    .min(0)
    .max(50)
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  askingRentFils: fils,
});
export type PlannedUnitInput = z.input<typeof plannedUnitSchema>;

export const createPlannedUnitsSchema = z
  .object({
    propertyId: z.string().uuid(),
    units: z.array(plannedUnitSchema).min(1, "required").max(MAX_PLANNED_UNITS),
  })
  .refine(
    (v) => new Set(v.units.map((u) => u.label.trim().toLowerCase())).size === v.units.length,
    { message: "duplicate", path: ["units"] },
  );
export type CreatePlannedUnitsInput = z.input<typeof createPlannedUnitsSchema>;

export const createPropertyWithPlanSchema = z.object({
  property: propertySchema,
  units: z.array(plannedUnitSchema).max(MAX_PLANNED_UNITS),
});
export type CreatePropertyWithPlanInput = z.input<typeof createPropertyWithPlanSchema>;
```

- [ ] **Step 4: Run tests**

Run: `pnpm test tests/unit/schemas.test.ts`
Expected: PASS (the old `bulkUnitsSchema` test still passes unchanged).

- [ ] **Step 5: Commit**

```bash
git add src/lib/schemas/master.ts tests/unit/schemas.test.ts
git commit -m "feat(schemas): property address and planned unit schemas"
```

---

### Task 5: Server actions — create planned units / create property with plan

**Files:**
- Modify: `src/server/actions/master.ts`

**Interfaces:**
- Consumes: `plannedUnitSchema`, `createPlannedUnitsSchema`, `createPropertyWithPlanSchema` (Task 4); `PlannedUnit` shape from Task 3.
- Produces: `createPlannedUnits(input: CreatePlannedUnitsInput)` → `ActionResult<number>`; `createPropertyWithPlan(input: CreatePropertyWithPlanInput)` → `ActionResult<string>`; `saveProperty` writes `governorate`.

- [ ] **Step 1: Update the import block**

```ts
import {
  beneficiarySchema,
  bulkUnitsSchema,
  categorySchema,
  createPlannedUnitsSchema,
  createPropertyWithPlanSchema,
  ownerSchema,
  propertySchema,
  tenantSchema,
  unitSchema,
  type BulkUnitsInput,
  type CreatePlannedUnitsInput,
  type CreatePropertyWithPlanInput,
  type OwnerInput,
  type PropertyInput,
  type TenantInput,
  type UnitInput,
} from "@/lib/schemas/master";
```

- [ ] **Step 2: Refactor `saveProperty` and add the shared helpers**

Replace the body of `saveProperty` from the `const row = {` line through the commission block with the extracted helper. The final shape:

```ts
type Supa = Awaited<ReturnType<typeof supabaseServer>>;

async function writePropertyRelations(
  db: Supa,
  ctx: { orgId: string },
  pid: string,
  d: z.output<typeof propertySchema>,
) {
  const del = await db.from("property_owners").delete().eq("property_id", pid);
  if (del.error) throw del.error;
  const ins = await db.from("property_owners").insert(
    d.owners.map((o) => ({
      org_id: ctx.orgId,
      property_id: pid,
      owner_id: o.ownerId,
      share_pct: o.sharePct,
    })),
  );
  if (ins.error) throw ins.error;
  if (d.commission !== undefined) {
    await db.from("property_commissions").delete().eq("property_id", pid);
    if (d.commission) {
      const c = await db
        .from("property_commissions")
        .insert({
          org_id: ctx.orgId,
          property_id: pid,
          kind: d.commission.kind,
          value: d.commission.value,
        });
      if (c.error) throw c.error;
    }
  }
}

function plannedUnitRows(
  orgId: string,
  propertyId: string,
  units: z.output<typeof plannedUnitSchema>[],
  startSort: number,
) {
  let sort = startSort;
  return units.map((u) => ({
    org_id: orgId,
    property_id: propertyId,
    label: u.label,
    sort_order: ++sort,
    type: u.type,
    floor: u.floor,
    area_m2: u.areaM2,
    bedrooms: u.bedrooms,
    bathrooms: u.bathrooms,
    asking_rent_fils: u.askingRentFils,
  }));
}

export async function saveProperty(id: string | null, input: PropertyInput) {
  return run(async () => {
    const ctx = await requireActionContext("manage_master_data");
    const d = propertySchema.parse(input);
    const db = await supabaseServer();
    const row = {
      org_id: ctx.orgId,
      name: d.name,
      name_en: d.nameEn,
      governorate: d.governorate,
      area: d.area,
      block: d.block,
      street: d.street,
      avenue: d.avenue,
      house_or_plot: d.houseOrPlot,
      paci_no: d.paciNo,
      property_type: d.propertyType,
      floors: d.floors ?? null,
      notes: d.notes,
    };
    const res = id
      ? await db.from("properties").update(row).eq("id", id).select("id").single()
      : await db.from("properties").insert(row).select("id").single();
    if (res.error) throw res.error;
    await writePropertyRelations(db, ctx, res.data.id, d);
    reval();
    return res.data.id;
  });
}
```

Import `plannedUnitSchema` too (used in the helper type). The existing `bulkCreateUnits` stays unchanged for now.

- [ ] **Step 3: Add the two new actions (after `bulkCreateUnits`)**

```ts
/** Creates the units of a property detail planner. One insert; labels unique per property. */
export async function createPlannedUnits(input: CreatePlannedUnitsInput) {
  return run(async () => {
    const ctx = await requireActionContext("manage_master_data");
    const d = createPlannedUnitsSchema.parse(input);
    const db = await supabaseServer();
    const { data: property } = await db
      .from("properties")
      .select("id")
      .eq("id", d.propertyId)
      .maybeSingle();
    if (!property) throw new ActionError("notFound");
    const { data: existing } = await db
      .from("units")
      .select("label, sort_order")
      .eq("property_id", d.propertyId);
    const existingLabels = new Set((existing ?? []).map((u) => u.label.trim().toLowerCase()));
    for (const u of d.units) {
      if (existingLabels.has(u.label.trim().toLowerCase())) throw new ActionError("duplicate");
    }
    const startSort = Math.max(0, ...(existing ?? []).map((u) => u.sort_order));
    const rows = plannedUnitRows(ctx.orgId, d.propertyId, d.units, startSort);
    const { error } = await db.from("units").insert(rows);
    if (error) throw error;
    reval();
    return rows.length;
  });
}

/**
 * Creates a property and (optionally) its planned units. If the units insert fails the
 * property row is deleted, so a "property saved" toast never hides a lost unit plan.
 */
export async function createPropertyWithPlan(input: CreatePropertyWithPlanInput) {
  return run(async () => {
    const ctx = await requireActionContext("manage_master_data");
    const d = createPropertyWithPlanSchema.parse(input);
    const db = await supabaseServer();
    const row = {
      org_id: ctx.orgId,
      name: d.property.name,
      name_en: d.property.nameEn,
      governorate: d.property.governorate,
      area: d.property.area,
      block: d.property.block,
      street: d.property.street,
      avenue: d.property.avenue,
      house_or_plot: d.property.houseOrPlot,
      paci_no: d.property.paciNo,
      property_type: d.property.propertyType,
      floors: d.property.floors ?? null,
      notes: d.property.notes,
    };
    const res = await db.from("properties").insert(row).select("id").single();
    if (res.error) throw res.error;
    const pid = res.data.id;
    try {
      await writePropertyRelations(db, ctx, pid, d.property);
      if (d.units.length > 0) {
        const rows = plannedUnitRows(ctx.orgId, pid, d.units, 0);
        const insUnits = await db.from("units").insert(rows);
        if (insUnits.error) throw insUnits.error;
      }
    } catch (e) {
      await db.from("properties").delete().eq("id", pid);
      throw e;
    }
    reval();
    return pid;
  });
}
```

- [ ] **Step 4: Verify**

```bash
pnpm typecheck && pnpm lint && pnpm test
```

Expected: green.

- [ ] **Step 5: Commit**

```bash
git add src/server/actions/master.ts
git commit -m "feat(server): planned unit creation actions"
```

---

### Task 6: UnitPlanner component + messages

**Files:**
- Create: `src/components/domain/units/unit-planner.tsx`
- Modify: `src/messages/ar/properties.json`, `src/messages/en/properties.json`

**Interfaces:**
- Consumes: `UnitPlanRow`, `PlannedUnit`, `FLOOR_MIN`, `FLOOR_MAX`, `MAX_PLANNED_UNITS`, `generatePlannedUnits`, `duplicateLabels`, `planIssues`, `planTotal` (Task 3).
- Produces: `defaultRow(floor)`, `UnitPlanner`, `UnitPlanValidation`, `isUnitPlanValid(rows, units, existingLabels?)`.

- [ ] **Step 1: Add messages to both locales**

In `src/messages/ar/properties.json`, add to the `"fields"` object:

```json
    "governorate": "المحافظة",
    "selectGovernorate": "اختر المحافظة",
    "selectArea": "اختر المنطقة",
    "address": "عنوان العقار",
```

and add this top-level block:

```json
  "planner": {
    "title": "إعداد الوحدات",
    "floorsTitle": "توزيع الوحدات على الأدوار",
    "floor": "الدور",
    "count": "عدد الوحدات",
    "type": "نوع الوحدة",
    "prefix": "بادئة الترقيم",
    "startNumber": "يبدأ من",
    "addFloor": "إضافة دور",
    "removeFloor": "حذف الدور",
    "defaults": "افتراضيات الوحدات",
    "askingRent": "الإيجار الشهري",
    "bedrooms": "غرف النوم",
    "area": "المساحة م²",
    "previewTitle": "الوحدات المولّدة",
    "unitLabel": "رقم الوحدة",
    "total": "الإجمالي {count, plural, zero {لا وحدات} one {وحدة واحدة} two {وحدتان} few {# وحدات} many {# وحدة} other {# وحدة}}",
    "regenerateHint": "تغيير صفوف الأدوار يعيد توليد قائمة الوحدات.",
    "errors": {
      "noUnits": "أضف وحدة واحدة على الأقل.",
      "tooMany": "الحد الأقصى {max} وحدة.",
      "duplicate": "رقم الوحدة «{label}» مكرر.",
      "floor": "رقم الدور من {min} إلى {max}."
    }
  },
```

In `src/messages/en/properties.json`, add:

```json
    "governorate": "Governorate",
    "selectGovernorate": "Select governorate",
    "selectArea": "Select area",
    "address": "Property address",
```

and:

```json
  "planner": {
    "title": "Unit setup",
    "floorsTitle": "Units per floor",
    "floor": "Floor",
    "count": "Units",
    "type": "Unit type",
    "prefix": "Number prefix",
    "startNumber": "Starts from",
    "addFloor": "Add floor",
    "removeFloor": "Remove floor",
    "defaults": "Unit defaults",
    "askingRent": "Monthly rent",
    "bedrooms": "Bedrooms",
    "area": "Area m²",
    "previewTitle": "Generated units",
    "unitLabel": "Unit number",
    "total": "{count, plural, =0 {No units} one {# unit} other {# units}}",
    "regenerateHint": "Changing floor rows regenerates the unit list.",
    "errors": {
      "noUnits": "Add at least one unit.",
      "tooMany": "Maximum {max} units.",
      "duplicate": "Unit number “{label}” is duplicated.",
      "floor": "Floor must be between {min} and {max}."
    }
  },
```

Run `pnpm test tests/unit/i18n.test.ts` — expected PASS (parity maintained).

- [ ] **Step 2: Create the planner component**

```tsx
// src/components/domain/units/unit-planner.tsx
"use client";
import { Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { UNIT_TYPES, type UnitType } from "@/domain/types";
import {
  FLOOR_MAX,
  FLOOR_MIN,
  MAX_PLANNED_UNITS,
  duplicateLabels,
  generatePlannedUnits,
  planIssues,
  planTotal,
  type PlannedUnit,
  type UnitPlanRow,
} from "@/domain/unit-plan";

export interface UnitPlannerValue {
  rows: UnitPlanRow[];
  units: PlannedUnit[];
}

export function defaultRow(floor: number): UnitPlanRow {
  return {
    floor,
    count: 1,
    type: "apartment",
    prefix: "",
    startNumber: floor > 0 ? floor * 100 + 1 : 1,
    askingRentFils: 0,
    bedrooms: null,
    areaM2: null,
  };
}

function floorOptions(t: (k: string, v: { n: number }) => string) {
  const options: { value: number; label: string }[] = [{ value: -1, label: t("basement", { n: 1 }) }];
  options.push({ value: 0, label: t("ground", { n: 0 }) });
  for (let n = 1; n <= 50; n++) options.push({ value: n, label: t("floor", { n }) });
  return options;
}

export function isUnitPlanValid(
  rows: UnitPlanRow[],
  units: PlannedUnit[],
  existingLabels: string[] = [],
): boolean {
  return units.length > 0 && planIssues(rows).length === 0 && duplicateLabels(units, existingLabels).length === 0;
}

/** Explicit floor-by-floor planner: rows -> deterministic generated units (no redistribution). */
export function UnitPlanner({
  rows,
  units,
  existingLabels = [],
  onChange,
}: {
  rows: UnitPlanRow[];
  units: PlannedUnit[];
  existingLabels?: string[];
  onChange: (v: UnitPlannerValue) => void;
}) {
  const t = useTranslations("properties.planner");
  const tStack = useTranslations("properties.stack");
  const tu = useTranslations("units.fields");
  const tType = useTranslations("enums.unitType");
  const floors = floorOptions(tStack);

  const regenerate = (next: UnitPlanRow[]) =>
    onChange({ rows: next, units: generatePlannedUnits(next) });
  const updateRow = (i: number, patch: Partial<UnitPlanRow>) =>
    regenerate(rows.map((r, x) => (x === i ? { ...r, ...patch } : r)));
  const addFloor = () => {
    const next = rows.length ? Math.max(...rows.map((r) => r.floor)) + 1 : 0;
    regenerate([...rows, defaultRow(Math.min(FLOOR_MAX, next))]);
  };
  const removeRow = (i: number) => regenerate(rows.filter((_, x) => x !== i));
  const updateUnit = (i: number, patch: Partial<PlannedUnit>) =>
    onChange({ rows, units: units.map((u, x) => (x === i ? { ...u, ...patch } : u)) });
  const setAll = (patch: Partial<UnitPlanRow>) =>
    regenerate(rows.map((r) => ({ ...r, ...patch })));
  const first = rows[0];

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-[16px] font-semibold">{t("floorsTitle")}</h3>
          <span className="text-label-2 text-[13px]">{t("total", { count: planTotal(rows) })}</span>
        </div>
        {rows.map((row, i) => (
          <div key={i} data-testid={`plan-row-${i}`} className="bg-paper space-y-3 rounded-[20px] p-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label={t("floor")} htmlFor={`plan-floor-${i}`}>
                <Select
                  id={`plan-floor-${i}`}
                  value={String(row.floor)}
                  onChange={(e) => updateRow(i, { floor: Number(e.target.value) })}
                >
                  {floors.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t("count")} htmlFor={`plan-count-${i}`}>
                <Input
                  id={`plan-count-${i}`}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={MAX_PLANNED_UNITS}
                  value={row.count}
                  onChange={(e) =>
                    updateRow(i, {
                      count: Math.max(1, Math.min(MAX_PLANNED_UNITS, Number(e.target.value) || 1)),
                    })
                  }
                />
              </Field>
              <Field label={t("type")} htmlFor={`plan-type-${i}`}>
                <Select
                  id={`plan-type-${i}`}
                  value={row.type}
                  onChange={(e) => updateRow(i, { type: e.target.value as UnitType })}
                >
                  {UNIT_TYPES.map((u) => (
                    <option key={u} value={u}>
                      {tType(u)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t("prefix")} htmlFor={`plan-prefix-${i}`}>
                <Input
                  id={`plan-prefix-${i}`}
                  value={row.prefix}
                  onChange={(e) => updateRow(i, { prefix: e.target.value })}
                />
              </Field>
              <Field label={t("startNumber")} htmlFor={`plan-start-${i}`}>
                <Input
                  id={`plan-start-${i}`}
                  type="number"
                  inputMode="numeric"
                  value={row.startNumber}
                  onChange={(e) => updateRow(i, { startNumber: Number(e.target.value) || 0 })}
                />
              </Field>
              <div className="flex items-end pb-0.5 sm:items-center sm:justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => removeRow(i)}
                  disabled={rows.length === 1}
                  aria-label={t("removeFloor")}
                >
                  <Trash2 />
                  {t("removeFloor")}
                </Button>
              </div>
            </div>
          </div>
        ))}
        <Button type="button" variant="secondary" size="sm" onClick={addFloor}>
          <Plus />
          {t("addFloor")}
        </Button>
      </div>

      <div className="space-y-3">
        <h3 className="text-[16px] font-semibold">{t("defaults")}</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label={t("askingRent")}>
            <MoneyInput
              value={first?.askingRentFils ?? 0}
              onChange={(v) => setAll({ askingRentFils: v ?? 0 })}
              showWords={false}
            />
          </Field>
          <Field label={t("bedrooms")} htmlFor="plan-bedrooms">
            <Input
              id="plan-bedrooms"
              type="number"
              inputMode="numeric"
              min={0}
              value={first?.bedrooms ?? ""}
              onChange={(e) =>
                setAll({ bedrooms: e.target.value === "" ? null : Number(e.target.value) })
              }
            />
          </Field>
          <Field label={t("area")} htmlFor="plan-area">
            <Input
              id="plan-area"
              inputMode="decimal"
              value={first?.areaM2 ?? ""}
              onChange={(e) =>
                setAll({ areaM2: e.target.value === "" ? null : Number(e.target.value) })
              }
            />
          </Field>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[16px] font-semibold">{t("previewTitle")}</h3>
          <span className="text-label-2 text-[12px]">{t("regenerateHint")}</span>
        </div>
        <ul className="max-h-80 space-y-2 overflow-y-auto pe-1">
          {units.map((u, i) => (
            <li key={i} className="bg-paper-2 space-y-2 rounded-[14px] p-2.5">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Input
                  aria-label={`${t("unitLabel")} ${i + 1}`}
                  value={u.label}
                  onChange={(e) => updateUnit(i, { label: e.target.value })}
                />
                <Select
                  aria-label={tu("floor")}
                  value={String(u.floor)}
                  onChange={(e) => updateUnit(i, { floor: Number(e.target.value) })}
                >
                  {floors.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </Select>
                <Select
                  aria-label={tu("type")}
                  value={u.type}
                  onChange={(e) => updateUnit(i, { type: e.target.value as UnitType })}
                >
                  {UNIT_TYPES.map((x) => (
                    <option key={x} value={x}>
                      {tType(x)}
                    </option>
                  ))}
                </Select>
                <MoneyInput
                  value={u.askingRentFils}
                  onChange={(v) => updateUnit(i, { askingRentFils: v ?? 0 })}
                  showWords={false}
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Input
                  aria-label={tu("area")}
                  inputMode="decimal"
                  value={u.areaM2 ?? ""}
                  onChange={(e) =>
                    updateUnit(i, { areaM2: e.target.value === "" ? null : Number(e.target.value) })
                  }
                />
                <Input
                  aria-label={tu("bedrooms")}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={u.bedrooms ?? ""}
                  onChange={(e) =>
                    updateUnit(i, { bedrooms: e.target.value === "" ? null : Number(e.target.value) })
                  }
                />
                <Input
                  aria-label={tu("bathrooms")}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={u.bathrooms ?? ""}
                  onChange={(e) =>
                    updateUnit(i, {
                      bathrooms: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Inline validation messages for the planner (duplicate labels, bounds, max count). */
export function UnitPlanValidation({
  rows,
  units,
  existingLabels = [],
}: {
  rows: UnitPlanRow[];
  units: PlannedUnit[];
  existingLabels?: string[];
}) {
  const t = useTranslations("properties.planner.errors");
  const issues = planIssues(rows);
  const dupes = duplicateLabels(units, existingLabels);
  const errors: string[] = [];
  if (issues.some((i) => i.code === "empty")) errors.push(t("noUnits"));
  if (issues.some((i) => i.code === "total"))
    errors.push(t("tooMany", { max: String(MAX_PLANNED_UNITS) }));
  if (issues.some((i) => i.code === "count")) errors.push(t("noUnits"));
  if (issues.some((i) => i.code === "floor"))
    errors.push(t("floor", { min: String(FLOOR_MIN), max: String(FLOOR_MAX) }));
  if (dupes.length > 0) errors.push(t("duplicate", { label: dupes[0]! }));
  if (errors.length === 0) return null;
  return (
    <ul className="space-y-1">
      {errors.map((e) => (
        <li key={e} role="alert" className="text-red-text px-1 text-[13px] leading-5">
          {e}
        </li>
      ))}
    </ul>
  );
}
```

Note `floorOptions` reuses `properties.stack` labels (`basement`, `ground`, `floor`) — those keys already exist in both locales.

- [ ] **Step 3: Verify**

```bash
pnpm typecheck && pnpm lint && pnpm test
```

Expected: green (i18n parity test included).

- [ ] **Step 4: Commit**

```bash
git add src/components/domain/units/unit-planner.tsx src/messages/ar/properties.json src/messages/en/properties.json
git commit -m "feat(ui): unit planner component"
```

---

### Task 7: Replace the even-spread bulk sheet with the planner

**Files:**
- Modify: `src/components/domain/units/bulk-units.tsx` (rewrite)
- Modify: `src/app/[locale]/(app)/properties/[id]/property-detail-view.tsx` (pass `existingLabels`)
- Modify: `src/server/actions/master.ts` (delete `bulkCreateUnits` + its import/type)
- Modify: `src/lib/schemas/master.ts` (delete `bulkUnitsSchema`/`BulkUnitsInput`)
- Modify: `tests/unit/schemas.test.ts` (drop the bulk test)
- Modify: `src/messages/ar/properties.json` + `src/messages/en/properties.json` (trim `bulk` keys)

**Interfaces:**
- Consumes: `UnitPlanner`, `UnitPlanValidation`, `isUnitPlanValid`, `defaultRow` (Task 6); `createPlannedUnits` (Task 5).
- Produces: `BulkUnitsSheet({ open, onOpenChange, propertyId, existingLabels? })`.

- [ ] **Step 1: Rewrite `bulk-units.tsx`**

```tsx
"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { createPlannedUnits } from "@/server/actions/master";
import { useAction } from "@/hooks/use-action";
import { generatePlannedUnits, type PlannedUnit, type UnitPlanRow } from "@/domain/unit-plan";
import {
  UnitPlanValidation,
  UnitPlanner,
  defaultRow,
  isUnitPlanValid,
} from "@/components/domain/units/unit-planner";

/** Adds units floor-by-floor using the shared UnitPlanner. */
export function BulkUnitsSheet({
  open,
  onOpenChange,
  propertyId,
  existingLabels = [],
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  propertyId: string;
  existingLabels?: string[];
}) {
  const t = useTranslations("properties.bulk");
  const router = useRouter();
  const { exec, pending } = useAction();
  const [rows, setRows] = useState<UnitPlanRow[]>([]);
  const [units, setUnits] = useState<PlannedUnit[]>([]);
  useEffect(() => {
    if (!open) return;
    const init = [defaultRow(0)];
    setRows(init);
    setUnits(generatePlannedUnits(init));
  }, [open]);
  const valid = isUnitPlanValid(rows, units, existingLabels);
  const submit = () =>
    exec(() => createPlannedUnits({ propertyId, units }), {
      success: t("created", { count: units.length }),
      onSuccess: () => {
        onOpenChange(false);
        router.refresh();
      },
    });
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={t("title")}
      footer={
        <Button block size="lg" onClick={submit} loading={pending} disabled={!valid}>
          {t("created", { count: units.length })}
        </Button>
      }
    >
      <div className="space-y-4">
        <UnitPlanner
          rows={rows}
          units={units}
          existingLabels={existingLabels}
          onChange={(v) => {
            setRows(v.rows);
            setUnits(v.units);
          }}
        />
        <UnitPlanValidation rows={rows} units={units} existingLabels={existingLabels} />
      </div>
    </Sheet>
  );
}
```

- [ ] **Step 2: Pass existing labels in the property detail**

In `property-detail-view.tsx`:

```tsx
<BulkUnitsSheet
  open={bulk}
  onOpenChange={setBulk}
  propertyId={p.id}
  existingLabels={stack.map((s) => s.label)}
/>
```

- [ ] **Step 3: Delete the old action and schema**

- `src/server/actions/master.ts`: remove the `bulkCreateUnits` function and the `bulkUnitsSchema` / `BulkUnitsInput` imports.
- `src/lib/schemas/master.ts`: delete the `bulkUnitsSchema` / `BulkUnitsInput` block.
- `tests/unit/schemas.test.ts`: remove `bulkUnitsSchema` from imports and delete the `bulk` part of the "unit & bulk" test (keep the `unitSchema` assertions; rename to `"unit"`).
- Both `properties.json` files: inside `"bulk"`, delete `count`, `startNumber`, `prefix`, `floorFrom`, `floorTo`, `preview`; keep `title` and `created`.

- [ ] **Step 4: Verify**

```bash
pnpm typecheck && pnpm lint && pnpm test
```

Expected: green; `bulkCreateUnits` and `bulkUnitsSchema` have no remaining references (search to confirm).

- [ ] **Step 5: Commit**

```bash
git add src/components/domain/units/bulk-units.tsx "src/app/[locale]/(app)/properties/[id]/property-detail-view.tsx" src/server/actions/master.ts src/lib/schemas/master.ts tests/unit/schemas.test.ts src/messages/ar/properties.json src/messages/en/properties.json
git commit -m "refactor(units): replace even-spread bulk add with unit planner"
```

---

### Task 8: Property form — Kuwait address + create-with-units wizard

**Files:**
- Modify: `src/components/domain/properties/property-form.tsx`
- Modify: `src/messages/ar/properties.json` + `src/messages/en/properties.json`

**Interfaces:**
- Consumes: `KUWAIT_GOVERNORATES`, `OTHER_AREA`, `areaAfterGovernorateChange` (Task 2); `defaultRow`, `UnitPlanner`, `UnitPlanValidation`, `isUnitPlanValid` (Task 6); `createPropertyWithPlan` (Task 5).
- Produces: `PropertyFormValue` includes `governorate: string`; create path is a 2-step flow (`details` → `units` with now/later).

- [ ] **Step 1: Add the form messages (both locales)**

In `src/messages/ar/properties.json` add top-level keys:

```json
  "search": "ابحث باسم العقار أو المحافظة أو المنطقة",
  "next": "التالي",
  "back": "السابق",
  "create": "إنشاء العقار",
  "steps": { "details": "بيانات العقار", "units": "الوحدات" },
  "unitsModeLabel": "وحدات العقار",
  "unitsMode": { "now": "إعداد الوحدات الآن", "later": "إضافة الوحدات لاحقًا" },
  "unitsLaterHint": "سيتم إنشاء العقار بدون وحدات، ويمكنك إضافتها لاحقًا من تبويب الوحدات.",
```

In `src/messages/en/properties.json`:

```json
  "search": "Search by name, governorate or area",
  "next": "Next",
  "back": "Back",
  "create": "Create property",
  "steps": { "details": "Property details", "units": "Units" },
  "unitsModeLabel": "Property units",
  "unitsMode": { "now": "Configure units now", "later": "Add units later" },
  "unitsLaterHint": "The property will be created without units; you can add them later from the Units tab.",
```

(`"search"` already exists — replace its value.)

- [ ] **Step 2: Update imports, EMPTY and the form state**

At the top of `property-form.tsx`:

```tsx
import { useLocale, useTranslations } from "next-intl";
import { Wizard } from "@/components/ui/wizard";
import { KUWAIT_GOVERNORATES, OTHER_AREA, areaAfterGovernorateChange } from "@/data/kuwait-addresses";
import { generatePlannedUnits, type PlannedUnit, type UnitPlanRow } from "@/domain/unit-plan";
import {
  UnitPlanValidation,
  UnitPlanner,
  defaultRow,
  isUnitPlanValid,
} from "@/components/domain/units/unit-planner";
import { createPropertyWithPlan, saveProperty } from "@/server/actions/master";
```

The previous import of `saveProperty` from `@/server/actions/master` is replaced by the line above; `useTranslations` should no longer be imported from `next-intl` twice.

Update `EMPTY`:

```tsx
const EMPTY: PropertyInput = {
  name: "",
  nameEn: "",
  governorate: "",
  area: "",
  block: "",
  street: "",
  avenue: "",
  houseOrPlot: "",
  paciNo: "",
  propertyType: "residential",
  floors: null,
  notes: "",
  owners: [],
  commission: null,
};
```

Inside the component add state and derived values:

```tsx
const locale = useLocale() as "ar" | "en";
const isCreate = !property;
const [step, setStep] = useState<"details" | "units">("details");
const [unitMode, setUnitMode] = useState<"now" | "later">("now");
const [planRows, setPlanRows] = useState<UnitPlanRow[]>([]);
const [planned, setPlanned] = useState<PlannedUnit[]>([]);
const governorate = watch("governorate");
const area = watch("area");
const selectedGov = KUWAIT_GOVERNORATES.find((g) => g.value === governorate);
const areaOptions = selectedGov?.areas ?? [];
const unitsValid = unitMode === "later" || isUnitPlanValid(planRows, planned, []);
```

Extend the existing reset effect:

```tsx
useEffect(() => {
  if (!open) return;
  form.reset(
    property ?? { ...EMPTY, owners: owners[0] ? [{ ownerId: owners[0].id, sharePct: 100 }] : [] },
  );
  setStep("details");
  setUnitMode("now");
  setPlanRows([]);
  setPlanned([]);
}, [open, property, owners, form]);
```

Replace the `submit` block:

```tsx
const moveToUnits = () => {
  setPlanRows((r) => {
    if (r.length) return r;
    const init = [defaultRow(0)];
    setPlanned(generatePlannedUnits(init));
    return init;
  });
  setStep("units");
};

const onValid = (v: PropertyInput) => {
  if (!property && step === "details") {
    moveToUnits();
    return;
  }
  if (!property) {
    return exec(() => createPropertyWithPlan({ property: v, units: unitMode === "later" ? [] : planned }), {
      success: t("saved"),
      onSuccess: (id) => {
        onOpenChange(false);
        onSaved?.(id);
        router.refresh();
      },
    });
  }
  return exec(() => saveProperty(property.id, v), {
    success: t("saved"),
    onSuccess: (id) => {
      onOpenChange(false);
      onSaved?.(id);
      router.refresh();
    },
  });
};

const submit = handleSubmit(onValid);
const nextStep = async () => {
  if (await form.trigger()) moveToUnits();
};
```

- [ ] **Step 3: Update the Sheet footer**

```tsx
footer={
  isCreate && step === "details" ? (
    <Button block size="lg" type="button" onClick={() => void nextStep()}>
      {t("next")}
    </Button>
  ) : isCreate ? (
    <div className="flex gap-3">
      <Button variant="secondary" size="lg" type="button" onClick={() => setStep("details")}>
        {t("back")}
      </Button>
      <Button block size="lg" onClick={submit} loading={pending} disabled={!unitsValid}>
        {t("create")}
      </Button>
    </div>
  ) : (
    <Button block size="lg" onClick={submit} loading={pending}>
      {tc("save")}
    </Button>
  )
}
```

- [ ] **Step 4: Replace the address fields and add the wizard wrapper**

Wrap the sheet body. Replace the current address grid (the `<div className="grid grid-cols-2 gap-4 sm:grid-cols-3">` containing area/block/street/avenue/house/paci) with this Kuwait address group, and wrap everything in the `Wizard` for create mode:

```tsx
{isCreate ? (
  <Wizard
    steps={[t("steps.details"), t("steps.units")]}
    current={step === "details" ? 0 : 1}
    onBack={() => setStep("details")}
    onNext={() => void nextStep()}
    hideFooter
  >
    {step === "details" ? (
      <form onSubmit={submit} className="space-y-5">
        {/* existing name/type/address/floors/owners/commission/notes fields */}
      </form>
    ) : (
      <div className="space-y-4">
        <Field label={t("unitsModeLabel")}>
          <SegmentedControl
            options={[
              { value: "now", label: t("unitsMode.now") },
              { value: "later", label: t("unitsMode.later") },
            ]}
            value={unitMode}
            onChange={(v) => setUnitMode(v as "now" | "later")}
          />
        </Field>
        {unitMode === "later" ? (
          <p className="text-label-2 text-[14px]">{t("unitsLaterHint")}</p>
        ) : (
          <>
            <UnitPlanner
              rows={planRows}
              units={planned}
              onChange={(v) => {
                setPlanRows(v.rows);
                setPlanned(v.units);
              }}
            />
            <UnitPlanValidation rows={planRows} units={planned} />
          </>
        )}
      </div>
    )}
  </Wizard>
) : (
  <form onSubmit={submit} className="space-y-5">
    {/* same fields, no wizard */}
  </form>
)}
```

To avoid duplicating the field markup, extract the fields into a local function value inside the component:

```tsx
const fields = (
  <>
    {/* the existing name/nameEn grid, type segmented control, and the rest */}
  </>
);
```

then render `{isCreate ? <Wizard ...>{step === "details" ? <form ...>{fields}</form> : unitsStep}</Wizard> : <form ...>{fields}</form>}`.

The Kuwait address group inside `fields` replaces the old address grid:

```tsx
<Field label={t("fields.address")} className="col-span-full">
  <span className="sr-only">{t("fields.address")}</span>
</Field>
<div className="grid gap-4 sm:grid-cols-2">
  <Field label={t("fields.governorate")} htmlFor="p-governorate" error={fe(errors.governorate?.message)}>
    <Controller
      control={control}
      name="governorate"
      render={({ field }) => (
        <Select
          id="p-governorate"
          value={field.value ?? ""}
          aria-invalid={!!errors.governorate}
          onChange={(e) => {
            const next = e.target.value;
            field.onChange(next);
            setValue("area", areaAfterGovernorateChange(form.getValues("area"), next), {
              shouldValidate: true,
            });
          }}
        >
          <option value="">{t("fields.selectGovernorate")}</option>
          {KUWAIT_GOVERNORATES.map((g) => (
            <option key={g.value} value={g.value}>
              {locale === "en" ? g.en : g.ar}
            </option>
          ))}
          {field.value && !selectedGov ? <option value={field.value}>{field.value}</option> : null}
        </Select>
      )}
    />
  </Field>
  <Field label={t("fields.area")} htmlFor="p-area" error={fe(errors.area?.message)}>
    <Controller
      control={control}
      name="area"
      render={({ field }) => (
        <Select
          id="p-area"
          value={field.value ?? ""}
          disabled={!governorate}
          aria-invalid={!!errors.area}
          onChange={(e) => field.onChange(e.target.value)}
        >
          <option value="">{t("fields.selectArea")}</option>
          {areaOptions.map((a) => (
            <option key={a.value} value={a.value}>
              {locale === "en" ? a.en : a.ar}
            </option>
          ))}
          <option value={OTHER_AREA.value}>
            {locale === "en" ? OTHER_AREA.en : OTHER_AREA.ar}
          </option>
          {field.value &&
          field.value !== OTHER_AREA.value &&
          !areaOptions.some((a) => a.value === field.value) ? (
            <option value={field.value}>{field.value}</option>
          ) : null}
        </Select>
      )}
    />
  </Field>
  <Field label={t("fields.block")} htmlFor="p-block">
    <Input id="p-block" inputMode="numeric" {...register("block")} />
  </Field>
  <Field label={t("fields.street")} htmlFor="p-street">
    <Input id="p-street" {...register("street")} />
  </Field>
  <Field label={t("fields.avenue")} htmlFor="p-avenue">
    <Input id="p-avenue" {...register("avenue")} />
  </Field>
  <Field label={t("fields.houseOrPlot")} htmlFor="p-house">
    <Input id="p-house" {...register("houseOrPlot")} />
  </Field>
  <Field label={t("fields.paciNo")} htmlFor="p-paci" error={fe(errors.paciNo?.message)}>
    <Input id="p-paci" dir="ltr" inputMode="numeric" maxLength={8} className="num" {...register("paciNo")} />
  </Field>
</div>
```

Drop the standalone `<Field label={t("fields.address")}>` wrapper if it renders nothing useful — keep the address grouping visible via a `GroupedSection`-like heading only if it looks right; otherwise the field labels are self-explanatory. (Do not ship an empty `Field` wrapper.)

- [ ] **Step 5: Verify**

```bash
pnpm typecheck && pnpm lint && pnpm test
```

Expected: green.

- [ ] **Step 6: Commit**

```bash
git add src/components/domain/properties/property-form.tsx src/messages/ar/properties.json src/messages/en/properties.json
git commit -m "feat(properties): Kuwait address fields and create-with-units flow"
```

---

### Task 9: Governorate in queries, cards, search and detail

**Files:**
- Modify: `src/server/queries/dataset.ts` (~line 40-51, 108-115, 255-265, 403-418)
- Modify: `src/server/queries/properties.ts` (~line 9-53)
- Modify: `src/app/[locale]/(app)/properties/[id]/page.tsx` (~line 61-71)
- Modify: `src/app/[locale]/(app)/properties/[id]/property-detail-view.tsx` (~lines 52-71, 120-132, 161, 506-526)
- Modify: `src/app/[locale]/(app)/properties/properties-view.tsx` (~lines 49, 59-76, 171)

**Interfaces:**
- Consumes: `governorateLabel`, `areaLabel`, `locationLabel` (Task 2).
- Produces: `OrgData.properties` meta gains `governorate: string | null`; `PropertySummary` gains `governorate: string | null`; `PropertyDetail` gains `governorate: string | null`.

- [ ] **Step 1: Dataset query**

In `src/server/queries/dataset.ts`, add `governorate` to the properties `.select(...)`, to the `OrgData` properties map type (`governorate: string | null;`), and to the returned map:

```ts
.select("id, name, name_en, area, governorate, property_type, cover_image_path, photos, floors, active")
```

```ts
      area: string | null;
      governorate: string | null;
```

```ts
          area: p.area,
          governorate: p.governorate,
```

- [ ] **Step 2: PropertySummary**

In `src/server/queries/properties.ts`, add to `PropertySummary`:

```ts
  governorate: string | null;
```

and in `propertySummaries`' return object:

```ts
      governorate: meta.governorate,
```

- [ ] **Step 3: Detail page pass-through**

In `src/app/[locale]/(app)/properties/[id]/page.tsx`, in the `property={{ ... }}` object add:

```ts
        governorate: property.governorate,
```

(`select("*")` already loads the column.)

- [ ] **Step 4: Detail view types + address + maps**

In `property-detail-view.tsx`:

- Add imports:

```tsx
import { areaLabel, governorateLabel, locationLabel } from "@/data/kuwait-addresses";
```

- Add to `PropertyDetail`:

```ts
  governorate: string | null;
```

- Replace the `address` and `mapsUrl` computation:

```tsx
  const govLabel = governorateLabel(p.governorate, locale);
  const areaText = areaLabel(p.area, locale, p.governorate);
  const address = join(
    [
      govLabel,
      areaText,
      p.block && `${t("fields.block")} ${p.block}`,
      p.street && `${t("fields.street")} ${p.street}`,
      p.avenue && `${t("fields.avenue")} ${p.avenue}`,
      p.houseOrPlot && `${t("fields.houseOrPlot")} ${p.houseOrPlot}`,
    ].filter((x): x is string => !!x),
  );
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    [govLabel, areaText, p.block ? `block ${p.block}` : "", p.street ?? "", "Kuwait"]
      .filter(Boolean)
      .join(" "),
  )}`;
```

- Replace the hero prop:

```tsx
          location={locationLabel(p.governorate, p.area, locale) || undefined}
```

- In the edit `PropertyFormSheet` `property={{ ... }}` add:

```ts
          governorate: p.governorate ?? "",
```

- [ ] **Step 5: Properties list search + card location**

In `properties-view.tsx`:

- Import `useLocale` is already there; import the helpers:

```tsx
import { areaLabel, governorateLabel, locationLabel } from "@/data/kuwait-addresses";
```

- Change `const locale = useLocale();` to `const locale = useLocale() as "ar" | "en";`
- Replace the filter's `.filter((p) => !s || [...])` with a localized haystack:

```tsx
      .filter((p) => {
        if (!s) return true;
        const hay = [
          p.name,
          p.nameEn ?? "",
          p.governorate ?? "",
          p.area ?? "",
          governorateLabel(p.governorate, locale),
          areaLabel(p.area, locale, p.governorate),
          ...p.ownerNames,
        ];
        return hay.some((x) => x.toLowerCase().includes(s));
      })
```

- Replace the card location:

```tsx
                location={locationLabel(p.governorate, p.area, locale) || undefined}
```

- [ ] **Step 6: Verify**

```bash
pnpm typecheck && pnpm lint && pnpm test
```

Expected: green.

- [ ] **Step 7: Commit**

```bash
git add src/server/queries/dataset.ts src/server/queries/properties.ts "src/app/[locale]/(app)/properties/[id]/page.tsx" "src/app/[locale]/(app)/properties/[id]/property-detail-view.tsx" "src/app/[locale]/(app)/properties/properties-view.tsx"
git commit -m "feat(properties): governorate in queries, search and detail"
```

---

### Task 10: E2E coverage + visual baselines

**Files:**
- Create: `tests/e2e/properties.spec.ts`
- Update: `tests/e2e/__screenshots__/visual.spec.ts/*-property.png` (only the affected baselines)

**Interfaces:**
- Consumes: the running app + local Supabase (`pnpm db:reset` first so the seed has governorates).

- [ ] **Step 1: Write the e2e spec**

```ts
// tests/e2e/properties.spec.ts
import { test, expect } from "@playwright/test";
import { config } from "dotenv";
import { login, supabaseUp } from "./helpers";

config({ path: ".env.local" });

test.describe("property creation: Kuwait address + unit planner", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!(await supabaseUp()), "Supabase not running");
    await login(page, "admin", "ar");
  });

  test("creates an uneven building and renders it in the stack", async ({ page }) => {
    await page.goto("/ar/properties");
    await page.getByRole("button", { name: "عقار جديد" }).first().click();
    await page.locator("#p-name").fill("برج الاختبار");
    await page.locator("#p-governorate").selectOption("حولي");
    await page.locator("#p-area").selectOption("السالمية");
    await page.locator("#p-block").fill("10");
    await page.locator("#p-street").fill("5");
    await page.locator("#p-house").fill("123");
    await page.locator("#p-paci").fill("12345678");
    await page.getByRole("button", { name: "التالي" }).click();

    // Ground: 2 shops (S1, S2)
    await page.locator("#plan-floor-0").selectOption("0");
    await page.locator("#plan-count-0").fill("2");
    await page.locator("#plan-type-0").selectOption("shop");
    await page.locator("#plan-prefix-0").fill("S");
    await page.locator("#plan-start-0").fill("1");

    const addFloor = async (row: number, floor: number, count: number, start: number) => {
      await page.getByRole("button", { name: "إضافة دور" }).click();
      await page.locator(`#plan-floor-${row}`).selectOption(String(floor));
      await page.locator(`#plan-count-${row}`).fill(String(count));
      await page.locator(`#plan-start-${row}`).fill(String(start));
    };
    await addFloor(1, 1, 4, 101);
    await addFloor(2, 2, 3, 201);
    await addFloor(3, 3, 5, 301);

    await expect(page.getByText("الإجمالي ١٤")).toBeVisible().catch(async () => {
      // The count is rendered with Western digits by default.
      await expect(page.getByText("الإجمالي 14")).toBeVisible();
    });

    await page.getByRole("button", { name: "إنشاء العقار" }).click();
    await expect(page.getByText("برج الاختبار")).toBeVisible({ timeout: 15_000 });

    // Search by governorate finds the property.
    await page.getByPlaceholder(/ابحث/).fill("حولي");
    await expect(page.getByText("برج الاختبار")).toBeVisible();

    // Open it: units tab shows the generated units on the right floors.
    await page.getByText("برج الاختبار").first().click();
    await page.getByRole("button", { name: "الوحدات" }).click();
    await expect(page.getByText("الدور 3")).toBeVisible();
    await expect(page.getByText("S1", { exact: true })).toBeVisible();
    await expect(page.getByText("301", { exact: true })).toBeVisible();
  });

  test("changing the governorate filters the area list", async ({ page }) => {
    await page.goto("/ar/properties");
    await page.getByRole("button", { name: "عقار جديد" }).first().click();
    await page.locator("#p-governorate").selectOption("حولي");
    await expect(page.locator('#p-area option[value="السالمية"]')).toHaveCount(1);
    await page.locator("#p-governorate").selectOption("الجهراء");
    await expect(page.locator('#p-area option[value="السالمية"]')).toHaveCount(0);
    await expect(page.locator('#p-area option[value="الجهراء"]')).toHaveCount(1);
  });
});
```

- [ ] **Step 2: Reset the DB and run the spec**

```bash
pnpm db:reset
pnpm db:types
pnpm test:e2e tests/e2e/properties.spec.ts
```

Expected: PASS. Fix selector mismatches in the spec (not the app) only when the app behavior is correct; if a selector is brittle, add a stable `id`/`data-testid` to the planner.

- [ ] **Step 3: Refresh visual baselines intentionally**

```bash
pnpm test:e2e tests/e2e/visual.spec.ts --update-snapshots=all
git status --short tests/e2e/__screenshots__
```

Expected changed baselines: only `*-property.png` (address now shows governorate · area) and any screen whose location line changed. Inspect the diff images; if unrelated screens changed, investigate before committing (do not blanket-accept). Then:

```bash
git add tests/e2e/properties.spec.ts tests/e2e/__screenshots__
git commit -m "test(e2e): property creation with planner; refresh visual baselines"
```

---

### Task 11: Final quality gate + decisions log

**Files:**
- Modify: `docs/DECISIONS.md`
- Modify: `docs/PROGRESS.md` (append a short change-set note under the latest section)

- [ ] **Step 1: Append decisions**

Append to the table in `docs/DECISIONS.md`:

```md
| 2026-10-03 | Kuwait address: new nullable `properties.governorate`; governorate and area are required by the app schema for new/edited properties. Governorate and area values are stored as canonical Arabic names (stable, printed in Arabic contracts) and resolved to English labels through `src/data/kuwait-addresses.ts`; legacy unknown values are preserved and displayed as-is. | Client feedback 2026-10-03; contracts print Arabic. |
| 2026-10-03 | Unit creation uses an explicit floor-by-floor planner (`src/domain/unit-plan.ts`): deterministic labels (prefix + start + index), floors never redistributed; the old even-spread `bulkCreateUnits` action was removed. The signup wizard's inline 4-per-floor convenience stays (out of scope). | Client feedback; paper-workflow reference. |
| 2026-10-03 | Creating a property with units inserts the property, then relations, then units in one statement; if units fail the property row is deleted (cascade cleans relations) so no "saved" toast hides a lost plan. | Brief §7.3. |
| 2026-10-03 | Planner preview regenerates whenever floor rows change; per-unit edits persist until the next row change (hint shown in the UI). | Predictable regeneration beats merge heuristics. |
| 2026-10-03 | Added شراء/Purchase (`capital`) to seed and new-office default expense categories; تأمين/Insurance already existed. Existing configurable categories untouched; no requests table introduced. | Client expense examples; no invented workflow. |
```

- [ ] **Step 2: Run the full gate**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

Expected: all green.

- [ ] **Step 3: Verify the acceptance walkthrough manually against the running app**

Using `pnpm dev` + seeded data:
1. Create "Salmiya Tower" (residential, Hawalli/Salmiya, block 10, street 5, plot 123, PACI 12345678, floors 3) with Ground 2 shops, floor 1 ×4, floor 2 ×3, floor 3 ×5 → exactly 14 units, card says 14, Unit tab groups them on floors 0/1/2/3.
2. Open a unit from the stack → existing unit editor works.
3. Edit a legacy property (e.g. الجابرية 157) → governorate shows "حولي" (seeded), area preserved.
4. Search "حولي" and "السالمية" → properties found.
5. Create an investment property with 2 ground shops + 6 offices; works with the existing `investment` type and unit types.
6. Create a property and choose "Add units later" → property with 0 units; add units from the Units tab via the planner.
7. Check the expense category list includes شراء and تأمين.

- [ ] **Step 4: Commit**

```bash
git add docs/DECISIONS.md docs/PROGRESS.md
git commit -m "chore: quality gate and decisions for Kuwait address and unit planner"
```

---

## Self-Review Notes

- **Spec coverage:** §4 migration (T1), §5 dataset (T2), §6 form/schema/save (T4/T5/T8), §7 planner + create flow + server + partial failure (T3/T5/T6/T7/T8), §8 expenses audit (T1; no new architecture), §9 display/search/detail (T9), §10 i18n (T6/T7/T8), §11 tests (T2/T3/T4/T10), §12 expected files, §14 legacy/add-later acceptance (T8/T10/T11), §15 gate (T11).
- **Explicitly out of scope (per brief):** no `units_count`, no second floor model, no `commercial` enum, no requests table, no second expense subsystem.
- **Type consistency:** `UnitPlanRow`/`PlannedUnit` are defined once in `src/domain/unit-plan.ts` and used by schemas, actions, planner and tests; `CreatePlannedUnitsInput`/`CreatePropertyWithPlanInput` are the action input types; `existingLabels` is `string[]` everywhere.
- **Ordering:** the old `bulkUnitsSchema`/`bulkCreateUnits` is only deleted in Task 7, after all imports moved — every task ends green.
