# CLAUDE.md — Ejari (إيجاري) · Rental Property Management System for Kuwait

> Product name: **إيجاري | Ejari** · domain **ejarikw.com** (Arabic primary, English secondary; single source of truth in `src/config/app.ts`).
> Primary market: Kuwaiti property owners and property-management offices.
> Primary language: **Arabic (RTL)**. Secondary: English (LTR).
> Currency: **Kuwaiti Dinar (KWD), 3 decimals (1 dinar = 1000 fils)**.
> Platform: **Installable PWA** (iOS, Android, desktop) with offline collections and web push notifications — see §19.
> Brand: fully designed bilingual identity (Arabic + English) — see §18. Quality bar — see §20.
> Standard: **highest possible quality**. This must feel like a flagship app from a top Gulf design studio, not an admin panel.

---

## 0. AUTONOMOUS EXECUTION PROTOCOL (READ FIRST, OBEY ALWAYS)

You are building this entire product **in one continuous run**. The human will not be watching.

1. **Never stop between phases.** When a phase's Definition of Done passes, immediately start the next phase. Do not ask for confirmation, do not summarize and wait, do not say "let me know if you want me to continue".
2. **Never ask the human questions.** When something is ambiguous, pick the most reasonable option that matches this spec and the Kuwaiti rental context, write it to `docs/DECISIONS.md` (date, decision, reason), and continue.
3. **Track progress** in `docs/PROGRESS.md`: a checklist of all phases and tasks. Update it at the end of every phase. If the session is interrupted and resumed, read `PROGRESS.md` first and continue from the first unchecked item.
4. **Quality gate at the end of every phase** (must be green before moving on):
   ```bash
   pnpm typecheck && pnpm lint && pnpm test && pnpm build
   ```
   If anything fails, fix it. Do not skip, disable, or `// @ts-ignore` your way past a failure. Do not delete tests to make them pass.
5. **Commit at the end of every phase**: `git add -A && git commit -m "phase N: <title>"`.
6. **Do not gold-plate one phase at the expense of finishing.** Complete all phases first at full functional quality; the final phase is for polish.
7. **If an external dependency is unavailable** (e.g. Docker for local Supabase), do not stop. Write the migrations and code anyway, verify with type checks, pure unit tests and the build, record the limitation in `DECISIONS.md`, and continue.
8. **No placeholder features.** No "coming soon", no `TODO` stubs in shipped UI, no fake buttons. Every visible control works.
9. **Final deliverable**: every phase checked in `PROGRESS.md`, all gates green, `README.md` with setup steps, and the acceptance checklist in §17 fully verified.

---

## 1. PRODUCT OVERVIEW

Ejari replaces the paper workflow of a Kuwaiti rental office that currently:
- writes lease contracts by editing Word documents by hand,
- prints a **monthly collection statement** per building (بيان بالإيرادات والمصروفات),
- issues **payment vouchers** for expenses (سند صرف),
- prepares a **monthly cover summary** across buildings: total collected, deposits, expenses.

Known problems with the paper process that Ejari must solve:
- **Arrears are invisible.** In the sample statement for Jabriya 157 (August 2026), expected rent is 8,960.000 and collected is 8,890.000, yet the arrears column shows 0.000 for every unit. Ejari calculates arrears automatically and carries them forward.
- **Shared expenses are charged to one building** (a meter-photocopy job covering Jabriya *and* Salmiya was charged only to Jabriya 157; salaries and car fuel are overhead). Ejari supports expense allocation across properties.
- **Contracts have no structured data**, so grace periods, free months, renewals, notice periods and expirations are not tracked.

### Core modules
1. Owners, properties, units (unit types: apartment, shop, room, half-basement front/back, basement, roof, office, warehouse, other).
2. Tenants.
3. Contracts with two templates: **Residential (سكني)** and **Investment (استثماري)**, generated from structured data, printable.
4. Rent schedule, collections, receipts, partial payments, advance payments, arrears.
5. Expense vouchers with multi-line, multi-property allocation.
6. Deposits (إيداعات) / owner remittances and cash-on-hand reconciliation.
7. Legal cases (حالة القضايا).
8. Reports: monthly property statement, cross-property monthly summary, late units, vacant units, accounting report (quarterly / semi-annual / annual), owner statement, tenant ledger, expiring contracts.
9. Dashboard with Apple-style widgets.
10. Owner portal (read-only, own properties).
11. Audit log, roles and permissions.

---

## 2. TECH STACK (fixed — do not substitute)

| Concern | Choice |
|---|---|
| Framework | **Next.js 15** (App Router, Server Components, Server Actions), **React 19** |
| Language | **TypeScript** strict (`"strict": true`, `noUncheckedIndexedAccess: true`) |
| Package manager | **pnpm** |
| Backend | **Supabase**: Postgres, Auth (email + password, magic link), Storage (private buckets), Row Level Security |
| Supabase client | `@supabase/ssr`, generated types in `src/lib/supabase/types.ts` |
| Styling | **Tailwind CSS v4**, CSS variables for tokens, logical properties (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`) only — never `ml-`/`mr-`/`left-`/`right-` |
| Components | **shadcn/ui** as a base, fully restyled to the design system in §9 |
| Motion | `motion` (Framer Motion) with spring presets; honor `prefers-reduced-motion` |
| Forms | `react-hook-form` + `zod` (shared schemas client/server) |
| Tables | `@tanstack/react-table` v8 |
| Charts | `recharts` |
| Command palette | `cmdk` |
| Toasts | `sonner` |
| Mobile sheets | `vaul` |
| Icons | `lucide-react` (flip directional icons in RTL) |
| Dates | `date-fns` + `@date-fns/tz`, timezone **Asia/Kuwait** |
| i18n | `next-intl`, locales `ar` (default) and `en` |
| Excel export | `exceljs` |
| Printing / PDF | Dedicated print routes with `@page` A4 CSS + `window.print()`; the "Download PDF" button opens the print route |
| Tests | **Vitest** (unit, domain logic), **Playwright** (e2e smoke) |
| Lint/format | ESLint (next + typescript-eslint strict), Prettier |
| PWA / service worker | **Serwist** (`@serwist/next`), `app/manifest.ts` |
| Web push | `web-push` (VAPID) on the server, Push API + Notifications API on the client |
| Offline storage | `idb` (IndexedDB) for the outbox and cached reads |
| Realtime | Supabase Realtime (in-app notification center, live collection sheet updates) |
| Brand asset pipeline | `sharp` script generating every icon/splash/OG size from master SVGs |
| Visual regression | Playwright screenshots (`toHaveScreenshot`) |
| Error monitoring | Sentry (`@sentry/nextjs`), enabled only when `SENTRY_DSN` is set |

Fonts (via `next/font/google`):
- **IBM Plex Sans Arabic** (Arabic UI and documents), weights 400/500/600/700.
- **Inter** (Latin text and all numerals), with `font-feature-settings: "tnum"` for tabular numbers in tables and amounts.

---

## 3. REPOSITORY STRUCTURE

```
/
├─ CLAUDE.md
├─ README.md
├─ docs/
│  ├─ PROGRESS.md
│  ├─ DECISIONS.md
│  └─ DOMAIN.md                 # glossary + business rules summary (generate from §4–§6)
├─ supabase/
│  ├─ config.toml
│  ├─ migrations/               # numbered SQL migrations
│  └─ seed.sql                  # demo data per §15
├─ src/
│  ├─ app/
│  │  ├─ [locale]/
│  │  │  ├─ (auth)/login, forgot-password, reset-password
│  │  │  ├─ (app)/               # authenticated shell
│  │  │  │  ├─ dashboard/
│  │  │  │  ├─ properties/[id]/  # overview, units, contracts, statement, expenses, documents
│  │  │  │  ├─ units/[id]/
│  │  │  │  ├─ tenants/[id]/
│  │  │  │  ├─ contracts/new/ contracts/[id]/
│  │  │  │  ├─ collections/      # monthly collection sheet
│  │  │  │  ├─ payments/[id]/
│  │  │  │  ├─ expenses/new/ expenses/[id]/
│  │  │  │  ├─ deposits/
│  │  │  │  ├─ legal/
│  │  │  │  ├─ owners/[id]/
│  │  │  │  ├─ reports/          # hub + each report
│  │  │  │  ├─ settings/         # org, users, templates, categories, numbering, preferences
│  │  │  │  └─ audit/
│  │  │  └─ (portal)/owner/      # owner read-only portal
│  │  └─ print/                  # print routes, no app chrome, locale-aware
│  │     ├─ contract/[id]/
│  │     ├─ receipt/[id]/
│  │     ├─ voucher/[id]/
│  │     ├─ statement/[propertyId]/[yyyy-mm]/
│  │     ├─ summary/[yyyy-mm]/
│  │     └─ report/[type]/
│  ├─ components/
│  │  ├─ ui/                     # design-system primitives (§9)
│  │  ├─ widgets/                # dashboard widgets (§10)
│  │  ├─ print/                  # print layouts
│  │  └─ domain/                 # feature components
│  ├─ domain/                    # PURE business logic, no I/O, 100% unit-tested
│  │  ├─ money.ts
│  │  ├─ tafqeet.ts              # Arabic number-to-words (KWD)
│  │  ├─ dates.ts
│  │  ├─ schedule.ts             # rent schedule generation
│  │  ├─ allocation.ts           # payment allocation
│  │  ├─ ledger.ts               # balances, arrears, statuses
│  │  ├─ expenses.ts             # expense allocation
│  │  ├─ contracts.ts            # lifecycle, penalties, renewal
│  │  ├─ templates.ts            # clause rendering engine
│  │  ├─ reports.ts              # report aggregations
│  │  └─ validation.ts           # civil ID, PACI, phone
│  ├─ server/
│  │  ├─ actions/                # server actions per module
│  │  └─ queries/                # typed data access
│  ├─ lib/ (supabase, auth, i18n, utils, export)
│  ├─ messages/ar.json, en.json
│  └─ config/app.ts
└─ tests/
   ├─ unit/
   └─ e2e/
```

---

## 4. DOMAIN GLOSSARY

| Arabic | English | Notes |
|---|---|---|
| عقار | Property | A building or plot (e.g. الجابرية 157) |
| وحدة | Unit | Apartment, shop, room, basement half, roof… |
| المالك / الطرف الأول | Owner / Party 1 | |
| المستأجر / الطرف الثاني | Tenant / Party 2 | |
| عقد إيجار سكني | Residential lease | |
| عقد إيجار استثماري | Investment (commercial) lease | Shops, offices, industrial plots |
| القيمة الإيجارية | Rent amount | Monthly |
| المحصل | Collected | |
| متأخرات السداد | Arrears | |
| سداد أشهر سابقة / لاحقة | Payment for previous / future months | |
| رقم الإيصال | Receipt number | Often from pre-printed receipt books; not sequential |
| سند صرف | Payment voucher (expense) | |
| نوع المصروف | Expense category | راتب شهري، مصاريف صيانة… |
| المستفيد | Beneficiary | Staff member, vendor, etc. |
| البيان | Description | |
| إيداعات | Deposits | Money deposited to bank / remitted to owner |
| مصاريف | Expenses | |
| حالة القضايا | Legal case status | لا يوجد = none |
| خالية | Vacant | |
| الرقم الآلي للعنوان | PACI address number | 8 digits, Kuwait's Public Authority for Civil Information |
| بطاقة مدنية | Civil ID | 12 digits |
| قطعة / شارع / جادة / منزل / قسيمة | Block / street / avenue / house / plot | Kuwaiti address parts |
| فترة سماح | Grace period | Before first collection |
| أشهر مجانية | Free months | Investment contracts; penalty if tenant leaves within 1 year |
| تأمين | Security deposit | |
| فلس | Fils | 1/1000 dinar |

---

## 5. MONEY, NUMBERS, DATES, VALIDATION (domain/*.ts)

### 5.1 Money
- **All amounts are stored as integer fils** (`bigint` in Postgres, `number` in TS; safe range is sufficient). Never use floats for money.
- `money.ts` exports: `toFils(input: string | number)`, `fromFils(fils): string` (`"8,890.000"`), `formatKWD(fils, { locale, showCurrency, compact })`, `add`, `sub`, `sum`, `splitEven(total, n)` (remainder fils go to the first parts, deterministic), `splitByWeights(total, weights)` (largest-remainder method, sum always equals total).
- Display: 3 decimals always (`300.000`), thousands separators, Western digits by default; optional Arabic-Indic digits via a user preference. Currency label `د.ك` in Arabic, `KWD` in English.

### 5.2 Tafqeet (Arabic amount in words) — `tafqeet.ts`
Required for contracts, receipts and vouchers. Output style matches the office's paper forms:
- `tafqeetKWD(195000)` → `فقط مائة وخمسة وتسعون دينار لا غير`
- `tafqeetKWD(650000)` → `فقط ستمائة وخمسون دينار كويتي لا غير` (option `withKuwaiti: true`)
- `tafqeetKWD(3750)` → `فقط ثلاثة دنانير وسبعمائة وخمسون فلس لا غير`
- `tafqeetKWD(8890000)` → `فقط ثمانية آلاف وثمانمائة وتسعون دينار لا غير`
- `tafqeetKWD(1000)` → `فقط دينار واحد لا غير`
- `tafqeetKWD(2000)` → `فقط ديناران لا غير` (acceptable: `دينارين`)
- `tafqeetKWD(250)` → `فقط مائتان وخمسون فلس لا غير`
- Support up to 999,999,999.999. Handle 0, 1, 2, 3–10, 11–99, hundreds (مائة، مائتان، ثلاثمائة… تسعمائة), thousands (ألف، ألفان، آلاف، ألف for 11+), millions.
- Also `tafqeetNumber(n)` for plain numbers and `tafqeetDuration(months)` → `خمس سنوات`, `سنة واحدة`, `ستة أشهر`, `سنتان`, `شهران`, `شهر واحد`.
- English equivalent `wordsEN(fils)` → `One hundred ninety-five Kuwaiti dinars only`.
- Minimum 40 unit tests.

### 5.3 Dates
- Timezone `Asia/Kuwait`. Store dates as `date` (no time) for business dates; `timestamptz` for audit.
- Display `dd/MM/yyyy`. Arabic day names: الأحد، الاثنين، الثلاثاء، الأربعاء، الخميس، الجمعة، السبت. `dayNameAr(date)` used in contract preamble. Verified: 2026-02-01 = الأحد, 2026-10-01 = الخميس.
- Arabic month names (Gregorian, Levantine/Gulf usage in office docs): يناير، فبراير، مارس، أبريل، مايو، يونيو، يوليو، أغسطس، سبتمبر، أكتوبر، نوفمبر، ديسمبر.
- Billing periods are calendar months keyed as `YYYY-MM`.

### 5.4 Validation
- Civil ID: 12 digits; validate the Kuwaiti checksum (weights `2,1,6,3,7,9,10,5,8,4,2` over the first 11 digits; check = `11 − (sum mod 11)`; invalid if result is 10 or ≥ 11 after mapping per standard). If checksum fails, show a **warning** (not a hard block) because data may be legacy.
- PACI number: 8 digits.
- Kuwaiti phone: 8 digits, starting with 2, 4, 5, 6 or 9; allow multiple phones per tenant.
- All validators live in `domain/validation.ts` with tests; zod schemas reuse them.

---

## 6. BUSINESS RULES

### 6.1 Organization & ownership
- Multi-tenant SaaS: every row has `org_id`. One organization = one office.
- An organization manages many **owners**; each owner has many **properties**; each property has many **units**.
- A property may have one owner (default) or multiple owners with percentage shares (sum = 100%).
- Optional management **commission** per owner or per property: percentage of collected rent or fixed monthly amount. Used in owner statements and accounting report.

### 6.2 Units
- Types: `apartment` شقة, `shop` محل, `room` غرفة, `basement` سرداب, `basement_front_half` نصف السرداب الأمامي, `basement_back_half` نصف السرداب الخلفي, `roof` السطح, `office` مكتب, `warehouse` مخزن, `plot` قسيمة, `other` أخرى.
- Fields: number/label (free text: "واحد", "8", "22"), type, floor (−1 basement, 0 ground, 1…n, `roof`), area m², bedrooms, bathrooms, own PACI number (optional), default asking rent, electricity meter number, water meter number, notes, active flag.
- **Unit status is derived**, never stored manually: `occupied` (active contract covers today), `vacant`, `reserved` (signed contract starting in the future), `in_grace` (occupied but before first collection date), `notice` (tenant gave notice), `legal` (open legal case).

### 6.3 Contracts
- Types: `residential` (سكني) and `investment` (استثماري).
- A contract has **one tenant** and **one or more units** (e.g. one tenant renting units 22, 23, 24 under one contract at 2,150.000). Rent is stored at contract level; optionally split per unit for reporting (`contract_units.rent_share_fils`, defaults to even split).
- Fields:
  - `contract_no` auto: `R-2026-0001` / `I-2026-0001` (per org, per type, per year, via `number_sequences`).
  - `contract_date` (signing date; day name derived).
  - `start_date` (بداية العقد).
  - `first_collection_date` (تاريخ أول تحصيل). Defaults to `start_date`. Must be ≥ `start_date`. Grace = months between.
  - `term_months` (default 60), `end_date` derived = `start_date + term_months − 1 day`.
  - `auto_renew` (default: investment true, residential false), `renewal_term_months`.
  - `monthly_rent_fils`.
  - `purpose` (سبب الإيجار): residential presets سكن عائلي، سكن عزاب، سكن موظفين; investment presets مكتب عقاري، محل تجاري، ورشة، مخزن، مطعم، صالون; free text allowed.
  - `utilities_party`: `owner` | `tenant` (clause 7).
  - `electricity_fixed_fils` (optional; investment sample: 3.750 monthly, charged to tenant as a separate charge line even when utilities are on the owner).
  - `free_months` (investment; integer ≥ 0), `free_months_penalty_window_months` (default 12).
  - `notice_period_months` (defaults: residential 2, investment 1; editable).
  - `security_deposit_fils` (optional) and deposit status (held / refunded / forfeited partially).
  - `annual_increase` (optional): percent or fixed fils, applied every N months.
  - `status`: `draft` → `active` → (`notice_given`) → `ended` | `terminated` | `renewed`.
  - `signed_file_path` (scan upload), additional attachments (civil ID copies, licenses).
  - `rendered_clauses` snapshot (JSON) frozen when status leaves `draft`.
  - `custom_clauses[]` appended after template clauses.
- A unit cannot have two overlapping active contracts (DB exclusion constraint on unit + daterange where status in active/notice_given).
- Rent revisions: `contract_rent_revisions(effective_from, monthly_rent_fils, reason)`; schedule uses the revision in effect for each period.
- Renewal: action "Renew" creates a new contract linked by `renewed_from_id`, pre-filled, new term, optional new rent; the old one becomes `renewed`.
- Termination: action "Terminate" asks for `move_out_date`, reason, and computes:
  - remaining arrears,
  - **early-exit penalty** for investment contracts: if `move_out_date < start_date + free_months_penalty_window_months` and `free_months > 0`, penalty = value of free months (free_months × monthly_rent) → added as a `penalty` charge (editable before confirming),
  - security deposit settlement (refund minus arrears/penalty, never negative),
  - future charges after move-out month are voided.
- Notice: action "Record notice" stores `notice_date` and `expected_move_out` (default `notice_date + notice_period_months`), status → `notice_given`.

### 6.4 Rent schedule (domain/schedule.ts)
- For each active contract, generate one **charge** per calendar month:
  - Months before `first_collection_date`'s month → a `free` charge line with amount 0 and `waived_value_fils` = rent (so concessions are reportable).
  - Month of `first_collection_date` onward → `rent` charge of the rent in effect; due date = 1st of month (or first_collection_date for the first one). If the contract starts mid-month, first month is **full rent** by default; org setting allows `prorate` (daily proration by days in month).
  - `electricity_fixed` charge monthly if set.
  - Ends at `end_date` or `move_out_date`.
- Charges are materialized in the `charges` table by a function `ensure_charges_until(org_id, period)`, called when viewing a month and by a nightly cron (Supabase `pg_cron` or a Next.js route secured by a secret, scheduled via Vercel Cron). It is **idempotent** (unique on contract_id + period + kind).
- Manual charges: `penalty`, `maintenance_recharge`, `other`, with description.
- **Adjustments** (discount / write-off) are separate rows with a mandatory reason and are shown in reports (e.g. unit 9 paying 300 instead of 320 is either arrears of 20 or an approved 20 discount — the user decides).

### 6.5 Payments & allocation (domain/allocation.ts)
- A **payment** (receipt) has: tenant, contract, amount_fils, method (`cash` نقدًا، `knet` كي نت، `bank_transfer` تحويل بنكي، `cheque` شيك، `link` رابط دفع), `received_at` date, `receipt_no` (manual, from receipt book; unique per org with a **warning**, not a block, on duplicates), optional system receipt number `RC-2026-00001`, collected_by (staff), reference (cheque no., transfer ref), notes, attachment.
- **Allocation**: default FIFO — oldest unpaid charge first (rent and electricity charges of the same period together), then current period, then **advance credit** for future periods. The user may override allocation manually in the payment sheet (choose periods).
- Unallocated remainder = tenant **credit** (advance payment); it is automatically consumed by future charges as they are generated.
- Reversal: payments are never deleted; they are **voided** with reason, which removes allocations and writes an audit entry.
- Per contract, per period status (domain/ledger.ts):
  - `paid` (charge fully covered), `partial`, `unpaid` (due date passed, nothing paid), `due` (not yet due), `advance` (paid before the period started), `free`, `vacant` (no contract), `legal`.
- **Arrears** as of date D = Σ charges due ≤ D − Σ allocations to those charges − Σ adjustments. Carried forward automatically month to month.
- **Days late** = D − due date of the oldest unpaid charge.

### 6.6 Monthly collection statement (per property, per month) — must replicate the paper layout
Header: property name, owner name, from date (1st), to date (last day).
Columns (RTL order, right to left):
1. رقم الوحدة (unit label; multi-unit contracts show "22, 23, 24")
2. اسم المستأجر (or **خالية** for vacant units)
3. حالة القضايا (لا يوجد / case status)
4. القيمة الإيجارية د.ك (this month's charge)
5. رقم الإيصال (receipt numbers of payments received in the month, comma-separated)
6. المحصل د.ك (total received in the month from this tenant for this property)
7. سداد أشهر سابقة / لاحقة (portion of this month's receipts applied to previous or future periods; show with a small label "سابق" / "لاحق")
8. تاريخ آخر سداد
9. متأخرات السداد (arrears at end of month, **computed**)
10. الملاحظات
Footer totals: Σ rent value, Σ collected, Σ previous/next, Σ arrears. Recipient name + signature boxes (اسم المستلم / توقيع المستلم).

Validation dataset (must reproduce exactly, see §15): Jabriya 157, August 2026 → Σ rent 8,960.000, Σ collected 8,890.000, arrears 70.000 (unit 9: 20.000, unit 20: 50.000).

### 6.7 Expenses (سند صرف)
- A **voucher** has: voucher_no (`EX-2026-00001` or manual), date, paid_from (`cash_box` الصندوق، `bank` البنك، `cheque` الشيك) + reference, notes, recipient name, attachments (invoice photos), status (`draft`, `posted`, `void`).
- Lines: amount_fils, category, beneficiary, description (البيان), and **allocation**:
  - `single` property (default), optionally a unit,
  - `split_even` across chosen properties,
  - `split_by_units` (weight = number of units),
  - `split_by_rent` (weight = expected rent of the period),
  - `manual_percent` / `manual_amount`.
  Allocation results stored in `expense_allocations` (property_id, unit_id?, amount_fils); sum must equal line amount.
- Voucher total = Σ lines; displayed in words (tafqeet).
- Seed categories: راتب شهري، مصاريف صيانة، وقود وسيارات، كهرباء وماء، نظافة، رسوم حكومية، قرطاسية وتصوير، عمولات، تأمين، أخرى. Categories have a type: `operating`, `capital`, `payroll`, `owner_draw`.
- Beneficiaries: staff (e.g. collector/haris with monthly salary), vendors (العمارتين), assets (السيارة فورد). Recurring expense templates (e.g. monthly salary 170.000) with "Generate this month's vouchers" action.

### 6.8 Deposits and cash reconciliation (إيداعات)
- A **deposit** records money moved out of the cash box: to the owner's bank account, to the office bank, or handed to the owner. Fields: date, amount, destination (owner/bank account), owner, properties covered (optional), reference, attachment.
- **Monthly cover summary** (per org or per owner, per month), replicating the paper cover sheet:
  ```
  الإيجارات المحصلة عن شهر أغسطس 2026
  إجمالي الإيجارات المحصلة = 17,475.000 د.ك
  إيداعات               = 17,280.000 د.ك
  مصاريف               =    195.000 د.ك
  ```
  plus a per-property breakdown and a **reconciliation line**: collected − expenses − deposits = difference (cash on hand). A non-zero difference is highlighted orange with a "Explain" note field.

### 6.9 Legal cases
- Per tenant/contract: case number, court, type (eviction إخلاء، rent claim مطالبة مالية، other), status (`none`, `filed` مرفوعة، `in_progress` منظورة، `judgment` صدر حكم، `enforcement` تنفيذ، `closed` مغلقة), amount claimed, next hearing date, lawyer, notes, attachments, timeline events.
- The statement column حالة القضايا shows the status label or لا يوجد.

### 6.10 Reports (all: on-screen, print/PDF, Excel)
1. **Monthly property statement** (§6.6).
2. **Monthly summary across properties** (§6.8 cover sheet + per-property rows: expected, collected, arrears, expenses, net, deposits).
3. **Late units report**: all contracts with arrears > 0 as of a date; columns: property, unit, tenant, phones, months overdue, amount overdue, oldest due date, days late, last payment date, legal status; grouped by property; sorting by amount/days; aging buckets 0–30, 31–60, 61–90, 90+.
4. **Vacant units report**: property, unit, type, floor, area, asking rent, vacant since, days vacant, lost rent to date (asking rent × months vacant).
5. **Accounting report per property** for a period (month / quarter / half-year / year / custom):
   - Gross potential rent (all units at asking or contract rent),
   - Vacancy loss,
   - Concessions (free months, discounts, write-offs),
   - Expected rent (charges),
   - Collected (split: current period, arrears recovered, advances),
   - Opening arrears → closing arrears,
   - Expenses by category,
   - Commission (if configured),
   - **Net operating income** = collected − expenses − commission,
   - Deposits / remittances to owner,
   - KPIs: occupancy rate (unit-days occupied ÷ unit-days available), collection rate (collected ÷ expected), average days late, turnover (move-ins/move-outs),
   - Month-by-month table and charts (stacked bars: collected vs arrears; line: occupancy).
   - Comparison with the previous period (Δ and %).
6. **Owner statement**: per owner, all properties, period, with commission and net payable, deposits made, balance.
7. **Tenant ledger**: every charge, payment, allocation, adjustment, running balance.
8. **Expiring contracts**: ending in the next 30/60/90 days, auto-renew flag, notices received.
9. **Expense report**: by category, by property, by beneficiary, by period.
10. **Grace/first-collection report**: contracts whose first collection date falls in the next 60 days.

### 6.11 Reminders
- For late tenants, a "Send reminder" action generates an Arabic message (editable template in settings) with amount and months, and opens `https://wa.me/965XXXXXXXX?text=...` or copies to clipboard. Log each reminder on the tenant timeline. No paid messaging API.

---

## 7. DATABASE SCHEMA (Supabase / Postgres)

Write as numbered migrations. All tables: `id uuid primary key default gen_random_uuid()`, `org_id uuid not null references orgs(id)`, `created_at timestamptz default now()`, `updated_at timestamptz default now()` (trigger), `created_by uuid references auth.users`. Money columns: `bigint` fils with `check (x >= 0)` where applicable. Use Postgres enums for fixed sets.

```
orgs(id, name, name_en, logo_path, settings jsonb)         -- settings: proration, receipt duplicate policy, reminder template, digits, commission defaults
org_members(org_id, user_id, role, display_name, phone, active)   -- role: admin | accountant | collector | viewer | owner
owners(org_id, full_name, civil_id, phones text[], email, iban, bank_name, address, notes, portal_user_id)
properties(org_id, name, area, block, street, avenue, house_or_plot, paci_no, property_type [residential|investment|mixed|industrial], floors, notes, cover_image_path, active)
property_owners(property_id, owner_id, share_pct numeric(5,2))
property_commissions(property_id, kind [percent|fixed], value, effective_from)
units(org_id, property_id, label, sort_order, type, floor, area_m2, bedrooms, bathrooms, paci_no, asking_rent_fils, elec_meter_no, water_meter_no, notes, active)
tenants(org_id, full_name, civil_id, nationality, phones text[], email, employer, emergency_contact, notes, blacklisted bool)
contract_templates(org_id nullable for system, type, name, version, preamble text, closing text, is_default)
template_clauses(template_id, position, key, body text, condition text nullable, optional bool, default_enabled bool)
contracts(org_id, contract_no, type, template_id, tenant_id, property_id, contract_date, start_date, first_collection_date, term_months, end_date, auto_renew, renewal_term_months, monthly_rent_fils, purpose, utilities_party, electricity_fixed_fils, free_months, free_months_penalty_window_months, notice_period_months, security_deposit_fils, deposit_status, annual_increase_kind, annual_increase_value, annual_increase_every_months, status, notice_date, expected_move_out, move_out_date, termination_reason, renewed_from_id, clause_overrides jsonb, custom_clauses jsonb, rendered_clauses jsonb, signed_file_path, notes)
contract_units(contract_id, unit_id, rent_share_fils)
contract_rent_revisions(contract_id, effective_from date, monthly_rent_fils, reason)
charges(org_id, contract_id, unit_id nullable, period char(7), kind [rent|free|electricity_fixed|penalty|maintenance_recharge|other], amount_fils, waived_value_fils, due_date, description, voided bool, void_reason)
   unique(contract_id, period, kind) where kind in (rent, free, electricity_fixed) and not voided
payments(org_id, tenant_id, contract_id, amount_fils, method, received_at date, receipt_no, system_no, reference, collected_by uuid, notes, attachment_path, voided bool, void_reason, voided_at, voided_by)
payment_allocations(payment_id, charge_id, amount_fils)
tenant_credits view or table (unallocated payment remainder)
adjustments(org_id, contract_id, charge_id nullable, kind [discount|write_off|correction], amount_fils, reason, approved_by)
expense_categories(org_id, name_ar, name_en, type, active)
beneficiaries(org_id, name, kind [staff|vendor|asset|other], phone, monthly_salary_fils, notes, active)
expense_vouchers(org_id, voucher_no, voucher_date, paid_from, reference, recipient_name, notes, status, attachment_paths text[])
expense_lines(voucher_id, position, amount_fils, category_id, beneficiary_id, description, allocation_mode)
expense_allocations(expense_line_id, property_id, unit_id nullable, amount_fils)
recurring_expenses(org_id, category_id, beneficiary_id, amount_fils, description, allocation jsonb, day_of_month, active)
deposits(org_id, deposit_date, amount_fils, destination [owner_bank|office_bank|cash_to_owner], owner_id nullable, bank_name, reference, notes, attachment_path)
deposit_properties(deposit_id, property_id, amount_fils)
monthly_closings(org_id, period, closed_at, closed_by, notes)          -- locks edits for that period (admin can reopen)
legal_cases(org_id, contract_id, tenant_id, case_no, court, type, status, amount_claimed_fils, next_hearing_date, lawyer, notes)
legal_case_events(case_id, event_date, title, notes, attachment_path)
reminders_log(org_id, tenant_id, contract_id, channel, message, sent_at, sent_by)
attachments(org_id, entity_type, entity_id, path, file_name, mime, size, uploaded_by)
number_sequences(org_id, key, year, last_value)                          -- function next_number(org, key) with row lock
audit_log(org_id, user_id, action, entity_type, entity_id, before jsonb, after jsonb, at)
```

Required database pieces:
- Exclusion constraint preventing overlapping active contracts on the same unit (`btree_gist`, daterange).
- Trigger: `updated_at`.
- Trigger: audit log on insert/update/delete for contracts, charges, payments, allocations, adjustments, vouchers, lines, allocations, deposits, legal cases.
- Function `next_number(org_id, key)` — gapless, transaction-safe.
- Function `ensure_charges_until(org_id, period)` (or implement in TS server action calling domain/schedule.ts; either is fine, document the choice).
- Views: `v_charge_balances` (charge amount − allocations − adjustments), `v_contract_balances`, `v_unit_status_today`, `v_property_month_summary`.
- Period lock: writes touching a closed period are rejected unless role = admin with explicit reopen.
- Storage buckets (private): `contracts`, `receipts`, `vouchers`, `documents`, `branding`. Access through signed URLs only.

### 7.1 Row Level Security
- Enable RLS on **every** table.
- Helper `is_member(org_id)`, `has_role(org_id, roles[])`.
- `admin`: everything in org. `accountant`: everything except users/org settings. `collector`: read properties/units/tenants/contracts, create payments and reminders, read own payments; no expenses/deposits/reports beyond late units. `viewer`: read-only. `owner`: read-only access to rows linked to properties where they are an owner (via `property_owners` + `owners.portal_user_id`), limited to portal views.
- Write SQL tests (pgTAP if available, otherwise a Vitest suite hitting local Supabase guarded by `SUPABASE_TEST=1`) proving cross-org isolation and role limits.

---

## 8. CONTRACT TEMPLATE ENGINE (domain/templates.ts)

- Templates consist of a **preamble**, ordered **clauses**, and a **signature block**.
- Placeholders: `{{variable}}`. Conditions: a small safe expression language evaluated in TS (no `eval`): `utilities_party == 'owner'`, `free_months > 0`, `electricity_fixed_fils > 0`, `unit_paci != ''`. Clauses whose condition is false are skipped.
- Clauses marked `optional` can be toggled per contract (stored in `clause_overrides`); users may also edit a clause's text for one contract (override) and add custom clauses.
- **Numbering is automatic** after skipping/toggling (1, 2, 3…), so references like "البند رقم (3)" use `{{clause_ref:term}}` resolving to the final number of the clause with key `term`.
- Rendered output is a structured array `{ number, key, text }[]`, used by both the on-screen preview and the print route. Frozen into `rendered_clauses` on activation.
- Available variables: `day_name, contract_date, contract_no, owner_name, owner_civil_id, owner_phones, tenant_name, tenant_civil_id, tenant_phones, property_description, property_paci, unit_type_label, unit_labels, unit_paci, purpose, rent_amount, rent_words, term_words, start_date, first_collection_date, end_date, free_months, free_months_words, notice_period_words, utilities_party_label, electricity_fixed_amount, electricity_fixed_words, security_deposit_amount, security_deposit_words`.
- `property_description` is generated: residential → `{{area}} قطعة {{block}} شارع {{street}} جادة {{avenue}} منزل {{house}}` (omit empty parts); investment → `القسيمة رقم {{plot}} في {{area}} قطعة {{block}} شارع {{street}} قسيمة {{house}}`.
- Templates are editable in Settings → Templates (versioned; editing creates a new version; existing contracts keep their snapshot).

### 8.1 Seed template: Residential (سكني)

Preamble:
```
عقد إيجار
انه في يوم {{day_name}} الموافق {{contract_date}}
تم الاتفاق بين كل من:
الطرف الأول: {{owner_name}}، المالك
ويحمل بطاقة مدنية رقم: {{owner_civil_id}}
الطرف الثاني: {{tenant_name}}، المستأجر
بطاقة مدنية: {{tenant_civil_id}}، تليفون: {{tenant_phones}}
حيث إن الطرف الأول يستغل {{property_description}} الرقم الآلي للعنوان {{property_paci}}
تم الاتفاق وذلك وفق الشروط التالية:
```
Clauses (key → text):
1. `unit` → `استأجر {{unit_type_label}} رقم {{unit_labels}} لاستعماله {{purpose}}.`
2. `rent` → `الإيجار الشهري المتفق عليه هو {{rent_amount}} دينار فقط {{rent_words}} دينار كويتي لا غير، تدفع في بداية كل شهر ميلادي.`
3. `grace` (condition `first_collection_date != start_date`, optional, default on) → `يبدأ استحقاق الإيجار اعتبارًا من {{first_collection_date}}.`
4. `term` → `مدة هذا العقد {{term_words}} تبدأ من {{start_date}} ويحق للطرف الثاني إخلاء العين المؤجرة بخطاب خطي قبلها ب{{notice_period_words}}.`
5. `end` → `هذا العقد ينتهي بانتهاء المدة المذكورة في البند رقم ({{clause_ref:term}}) ما لم يوافق الطرفان على تجديده خطيًا.`
6. `maintenance` → `يتعهد المستأجر بالمحافظة على سلامة ونظافة العين المؤجرة موضوع هذا العقد ويكون مسؤولًا عن كل ضرر فيه بما فيها التكييف والكهرباء والأدوات الصحية والأبواب والزجاج وغيرها ويتم تصليحه من حسابه الخاص.`
7. `neighbors` → `يتعهد المستأجر بالمحافظة على علاقة حسن الجوار مع الآخرين وعدم عرقلة حركة المرور في العقار كله.`
8. `utilities` → `دفع تأمين الكهرباء واستهلاك الكهرباء والماء من حساب {{utilities_party_label}} وحده.`
9. `deposit` (condition `security_deposit_fils > 0`) → `دفع الطرف الثاني مبلغ {{security_deposit_amount}} دينار ({{security_deposit_words}}) تأمينًا يرد عند انتهاء العقد وتسليم العين بحالتها بعد خصم أي مستحقات.`
10. `no_changes` → `لا يحق للمستأجر أن يحدث أي تغيير أو وضع أي إعلان في العين المؤجرة إلا بموافقة خطية من المالك.`
11. `no_assignment` → `لا يحق للمستأجر أن يتنازل عن كل أو بعض هذا العقد أو إدخال أي طرف آخر فيه إلا بالموافقة الخطية من المالك.`
12. `jurisdiction` → `القضاء الكويتي هو الفصل في أي نزاع بين طرفي هذا العقد.`
13. `copies` → `حرر هذا العقد من نسختين وبين كل طرف نسخة منه.`

Signature block: two columns — `الطرف الأول` (name, signature) / `الطرف الثاني` (name, signature).

### 8.2 Seed template: Investment (استثماري)

Preamble:
```
عقد إيجار
انه في يوم {{day_name}} الموافق {{contract_date}}
تم الاتفاق بين كل من:
الطرف الأول: {{owner_name}}، المالك
ويحمل بطاقة مدنية رقم: {{owner_civil_id}}
الطرف الثاني: {{tenant_name}}، رقم مدني: {{tenant_civil_id}}
ت: {{tenant_phones}}
حيث إن الطرف الأول يستغل {{property_description}} الرقم الآلي للعنوان {{property_paci}}
فقد تم الاتفاق بين طرفي هذا العقد على ما يلي:
```
Clauses:
1. `unit` → `استأجر الطرف الثاني {{unit_type_label}} رقم {{unit_labels}}{{#unit_paci}} الرقم الآلي للمحل: {{unit_paci}}{{/unit_paci}}.`
2. `inspection` → `أقر الطرف الثاني بأنه عاين العين موضوع هذا العقد المعاينة التامة النافية للجهالة وقبلها وأقر أنها صالحة لحاجته ومزاولة عمله.`
3. `rent` → `استأجر الطرف الثاني {{unit_type_label}} نظير إيجار شهري قيمته {{rent_amount}} دينار كويتي فقط {{rent_words}} دينار كويتي لا غير تدفع في بداية كل شهر ميلادي.`
4. `term` → `مدة هذا العقد {{term_words}} تبتدئ في: {{start_date}}، تجدد تلقائيًا.` + (condition `free_months > 0`) ` وقد منح الطرف الثاني {{free_months_words}} مجانًا ويبدأ استحقاق الإيجار في {{first_collection_date}}، وفي حال رغبة الطرف الثاني إخلاء العين المؤجرة قبل مضي سنة واحدة فإنه ملزم بسداد قيمة الأشهر المجانية التي تم منحها له في بداية هذا العقد.`
   (Implement `auto_renew == false` variant: `…تبتدئ في: {{start_date}} وتنتهي في {{end_date}}.`)
5. `purpose` → `أقر الطرف الثاني أنه استأجر العين موضوع هذا العقد لمزاولة: {{purpose}}، ولا يحق له تغيير هذا العمل إلا بالموافقة الخطية من الطرف الأول والجهات الرسمية.`
6. `licenses` → `إن استخراج تراخيص مزاولة العمل لهذا العقد هي مسؤولية الطرف الثاني فقط ولا يتحمل الطرف الأول أية مسؤولية مادية أو أدبية إذا لم يتمكن المستأجر من الحصول عليها.`
7. `utilities` → owner variant: `دفع تأمين الكهرباء واستهلاك الكهرباء والماء من حساب الطرف الأول فقط{{#electricity_fixed_amount}} وقيمة استهلاك الكهرباء {{electricity_fixed_amount}} دينار شهريًا، {{electricity_fixed_words}}{{/electricity_fixed_amount}}.`; tenant variant: `دفع تأمين الكهرباء واستهلاك الكهرباء والماء من حساب الطرف الثاني وحده.`
8. `electric_load` → `لا يحق للطرف الثاني زيادة أحمال الكهرباء للمحل موضوع هذا العقد إلا بالموافقة الرسمية من وزارة الكهرباء مع تحمل الطرف الثاني جميع تكاليف زيادة هذه الأحمال من حسابه الخاص وحده.`
9. `fresh_water` → `إذا رغب الطرف الثاني بتزويد العين موضوع هذا العقد بالماء العذب فإنه يتم الاتفاق على كمية وقيمة الاستهلاك شهريًا.`
   (The source contract has this twice, as clauses 9 and 11. Merge into one clause and log in DECISIONS.md.)
10. `industry_authority` (optional, default on when property_type = industrial) → `في حال قررت الهيئة العامة للصناعة زيادة مبالغ مالية إيجارية على القسيمة فوق ما هو مقرر حين إبرام هذا العقد فإن الطرف الثاني قد وافق على أن يسدد ما يترتب عليه مقابل هذه الزيادة في حدود المساحة التأجيرية الخاصة به في هذا العقد.`
11. `cleanliness` → `لا يحق للطرف الثاني وضع أي مواد أو بضائع أو مخلفات خارج حدود العين ويجب عليه المحافظة على النظافة العامة ومنطقة الخدمات والأدراج.`
12. `fire_safety` → `لا يحق للطرف الثاني تخزين أية مواد قابلة للاشتعال داخل المحل أو خارجه ويلتزم بشروط الإدارة العامة للإطفاء ويتحمل وحده المسؤولية الكاملة عن مخالفة العقد.`
13. `parking` → `لا يحق للطرف الثاني أن يستخدم مواقف سيارات المحلات الأخرى.`
14. `roof` → `لا يحق للطرف الثاني استخدام أسطح القسيمة للتخزين أو خلافه دون الرجوع للطرف الأول وموافقته خطيًا.`
15. `signage` → `لا يحق للطرف الثاني تركيب الإعلان الخاص به إلا في المكان المخصص له فقط وأي زيادة يحق للمالك إزالتها.`
16. `structure` → `يتعهد الطرف الثاني بعدم إزالة أو إضافة مبانٍ أو منشآت في المحل إلا بالموافقة الخطية من الطرف الأول والجهات الرسمية المختصة.`
17. `neighbors` → `يتعهد الطرف الثاني بالمحافظة على حسن الجوار وممتلكات الآخرين والخدمات العامة.`
18. `no_assignment` → `لا يحق للطرف الثاني التنازل عن هذا العقد أو جزء منه أو إدخال طرف آخر به إلا بالموافقة الخطية من الطرف الأول.`
19. `handover` → `في حال ترك الطرف الثاني المحل موضوع هذا العقد أو فسخه فإنه يتعهد أن يعيده كما كان حين استلمه.`
20. `amendments` → `كل تغيير بهذا العقد وشروطه لا يعتد به إلا بالموافقة الخطية من الطرف الأول ويعتبر هذا العقد ملغيًا في حال مخالفة الطرف الثاني لأي من بنوده والتزاماته التعاقدية.`
21. `termination_notice` → `إذا رغب الطرف الثاني في فسخ هذا العقد فيجب عليه إبلاغ الطرف الأول خطيًا وقبل {{notice_period_words}} من فسخ العقد.`
22. `address` → `عنوان المراسلة لطرفي هذا العقد هو المسجل في البطاقة المدنية لكل منهما.`
23. `annex` → `البنود التي لم يرد ذكرها في هذا العقد يتم التفاهم عليها في عقد ملحق لهذا العقد ويوقع من طرفي هذا العقد.`
24. `jurisdiction` → `محاكم الكويت هي الفصل في أي نزاع قد ينشأ لا قدر الله.`
25. `no_worker_housing` → `سكن العمال وغيرهم ومبيتهم غير مسموح به بتاتًا في القسيمة موضوع هذا العقد.`

Signature block: `الطرف الأول — الاسم: {{owner_name}} — التوقيع:` / `الطرف الثاني — الاسم: {{tenant_name}} — التوقيع:`.

`{{#var}}…{{/var}}` = section rendered only when var is non-empty/non-zero.

### 8.3 Contract print layout
A4, margins 18mm, IBM Plex Sans Arabic 12.5pt, line-height 1.9. Title "عقد إيجار" centered 26pt. Optional org letterhead (logo + name) toggled in settings. Contract number and QR code (links to contract in app) in the top corner (small). Numbered clauses with hanging indent. Signature block on the same page as the last clause when possible (`break-inside: avoid`). Footer: page X / Y, contract number.

---

## 9. DESIGN SYSTEM — "Apple-like", RTL-first

> The client-approved visual direction is **§21 "Photo-led glass"**. §9 defines structure, primitives and behavior; §21 overrides colors, radii, controls and screen composition. Read both before building any UI.

The UI must feel like a native Apple app (iOS 18 / macOS Sonoma settings & Wallet quality), written in Arabic first. Calm, spacious, legible, precise numbers, subtle depth, fluid motion.

### 9.1 Principles
1. **Clarity**: one primary action per screen; large titles; generous whitespace; no visual noise.
2. **Deference**: content (numbers, names) is the hero; chrome is translucent and quiet.
3. **Depth**: layered surfaces — grouped background → cards → sheets → popovers, each with its own elevation and material.
4. **Numbers are sacred**: tabular figures, right-aligned in LTR / left-aligned in RTL tables consistently, 3 decimals, currency label muted.
5. **RTL native**: layout, icons, gestures, charts and animations mirror correctly. Never ship a LTR-looking Arabic screen.

### 9.2 Tokens (CSS variables in `src/app/globals.css`, light + dark)
```
--bg-grouped:        #F2F2F7   / dark #000000
--bg-elevated:       #FFFFFF   / dark #1C1C1E
--bg-elevated-2:     #F9F9FB   / dark #2C2C2E
--bg-inset:          #EFEFF4   / dark #2C2C2E
--separator:         rgba(60,60,67,0.18) / dark rgba(84,84,88,0.6)
--label:             #000000   / dark #FFFFFF
--label-2:           rgba(60,60,67,0.60) / dark rgba(235,235,245,0.60)
--label-3:           rgba(60,60,67,0.30) / dark rgba(235,235,245,0.30)
--accent:            #007AFF   / dark #0A84FF     (systemBlue; configurable per org)
--green:  #34C759 / #30D158   (paid)
--orange: #FF9500 / #FF9F0A   (partial, due soon, warnings)
--red:    #FF3B30 / #FF453A   (late, legal)
--indigo: #5856D6 / #5E5CE6   (advance)
--teal:   #30B0C7 / #40C8E0   (free / grace)
--gray:   #8E8E93 / #98989D   (vacant)
--radius-sm: 10px  --radius-md: 14px  --radius-lg: 20px  --radius-xl: 28px
--shadow-card: 0 1px 2px rgba(0,0,0,.04), 0 4px 16px rgba(0,0,0,.04)
--shadow-float: 0 8px 40px rgba(0,0,0,.12)
--material-bar: saturate(180%) blur(20px) over rgba(255,255,255,.72) / dark rgba(28,28,30,.72)
```
Spacing scale 4-based (4, 8, 12, 16, 20, 24, 32, 44). Minimum hit target 44×44.

Typography (Arabic sizes +1px vs Latin for legibility):
- Large Title 34/41 bold · Title1 28 · Title2 22 · Title3 20 semibold · Headline 17 semibold · Body 17 · Callout 16 · Subhead 15 · Footnote 13 · Caption 12.
- Amounts in widgets: 34–44px semibold Inter tnum, currency label Footnote in `--label-2`.

Motion presets (`src/lib/motion.ts`): `spring = { type: "spring", stiffness: 400, damping: 32 }`, `gentle = { stiffness: 260, damping: 30 }`. Sheets slide from bottom on mobile and from the **end** edge on desktop (left in RTL). List insert/remove animate height + opacity. Number changes animate with a rolling counter. All motion disabled under `prefers-reduced-motion`.

Themes: light, dark, system. Accent color picker (6 Apple system colors). Density: comfortable / compact (tables).

### 9.3 Primitives to build in `components/ui/` (restyle shadcn where applicable)
- `AppShell`: desktop — translucent sidebar (start edge) with sections and SF-style icons, collapsible; mobile — bottom **tab bar** (Dashboard, Collections, Properties, Reports, More) with material blur.
- `LargeTitleHeader`: large title that collapses into an inline bar title on scroll (sticky, material background), with trailing actions and optional search field.
- `GroupedList`, `GroupedSection` (header/footer captions), `ListRow` (leading icon tile with colored rounded-square background, title, subtitle, trailing value/badge, chevron that mirrors in RTL, swipe actions on touch).
- `Card`, `WidgetCard` (sizes: `sm` 1×1, `md` 2×1, `lg` 2×2, `xl` 4×2 in a bento grid).
- `SegmentedControl` (animated thumb), `Toggle` (iOS switch), `Stepper` (±), `Picker`/`Select`, `DatePicker` (dd/MM/yyyy, Arabic month names), `MonthPicker` (YYYY-MM with arrows), `MoneyInput` (fils-safe, 3 decimals, live tafqeet preview beneath), `PhoneInput` (+965), `CivilIdInput` (checksum hint), `SearchField` (pill), `Chip`/`StatusPill`.
- `Sheet` (vaul on mobile / side panel on desktop), `Dialog` (alert style, centered, destructive actions in red), `Popover`, `ContextMenu`, `ActionSheet` (mobile).
- `Toast` (sonner styled as iOS banners).
- `DataTable`: sticky header with material, sticky totals footer, column visibility, sorting, grouping, row selection with bulk bar, keyboard navigation, compact density, zebra off, hairline separators, virtualization for > 200 rows.
- `ProgressRing`, `Sparkline`, `BarMini`, `Heatmap`, `Donut`, `Meter` (horizontal capacity bar like iOS storage).
- `EmptyState` (large soft icon, title, one-line text, primary button).
- `Skeleton` (shimmer), `Spinner` (iOS activity indicator).
- `CommandPalette` (⌘K / Ctrl+K): search tenants, units, contracts, receipts, vouchers; actions: "Record payment", "New contract", "New voucher", "Go to August statement".
- `KeyboardShortcuts` sheet (`?`).
- `Wizard` (multi-step with progress dots, back/next, save draft).

Status colors mapping (used everywhere, including heatmap and pills):
`paid` green · `partial` orange · `unpaid` red · `due` label-3 outline · `advance` indigo · `free/grace` teal · `vacant` gray · `legal` red with gavel icon.

Accessibility: WCAG AA contrast, focus rings (accent 2px, offset 2), all icons with labels, tables with proper headers, screen-reader labels in Arabic and English, full keyboard operation.

---

## 10. SCREENS & WIDGETS

### 10.1 Dashboard (bento grid, responsive 4 → 2 → 1 columns, widgets reorderable and hideable, layout persisted per user)
Global filters in header: period (MonthPicker), property (All / specific), owner.

Widgets:
1. **Collection this month** (lg): big ProgressRing collected / expected, amounts, % and Δ vs last month; tap → collections sheet.
2. **Arrears** (md): total arrears, count of late units, aging mini-bars (0–30/31–60/61–90/90+), top 3 late tenants with days late; tap → late units report.
3. **Occupancy** (sm): donut occupied / vacant / grace, rate %.
4. **Vacant units** (md): list with property, unit, days vacant, asking rent; action "Create contract".
5. **Cash position** (md): collected − expenses − deposits = cash on hand this month, with Meter bar; warning if negative.
6. **12-month trend** (xl): bars collected vs expected, line occupancy.
7. **Payment heatmap** (xl): rows = units (grouped by property), columns = last 12 months, cells colored by status; hover/tap shows amount and receipt; the "wow" widget.
8. **Expiring & notices** (md): contracts ending in ≤ 90 days, notices received, auto-renew badges.
9. **First collections coming** (sm): grace periods ending in ≤ 60 days.
10. **Expenses this month** (md): total, by category mini-donut, last 3 vouchers.
11. **Legal** (sm): open cases, next hearing date.
12. **Quick actions** (sm): Record payment · New voucher · New contract · Print statement.
13. **Today** (sm, top): greeting, date in Arabic, count of payments recorded today by the current user.

### 10.2 Properties
- List: cards with cover image or generated gradient + icon, name, area, owner, units count, occupancy Meter, this month collected / expected, arrears badge. Search, filter by owner/type.
- Property detail (tabs as SegmentedControl): **Overview** (KPIs, mini widgets, address with PACI and "Open in maps" link, owners with shares), **Units** (the **Building Stack**: floors as horizontal rows from roof to basement, each unit a tile colored by status showing label, tenant first name, rent; tap tile → unit sheet), **Contracts**, **Statement** (monthly statement §6.6 embedded with MonthPicker and print/export), **Expenses**, **Documents**, **Settings** (commission, default templates).
- Create/edit property form; bulk-add units ("Add 20 apartments numbered 1–20, floors 1–5, asking rent 300").

### 10.3 Units
Unit sheet/page: status header, current contract, tenant, rent, balance, 12-month mini heatmap, history of contracts, meters, documents, actions (New contract, Record payment, Mark maintenance).

### 10.4 Tenants
List with search (name, civil ID, phone), balance, status. Tenant page: contact card (tap to call / WhatsApp), contracts, **ledger** (charges, payments, allocations, running balance), reminders log, legal cases, documents, blacklist toggle with reason.

### 10.5 Contracts
- List with filters (type, status, property, expiring), and status pills.
- **New contract wizard** (full-screen on mobile, large sheet on desktop), autosaves as draft:
  1. **Type**: two big selectable cards — سكني / استثماري (icons: house / storefront).
  2. **Parties**: owner (pre-filled from property, editable), tenant (search existing or create inline with civil ID/phones).
  3. **Property & units**: pick property → select one or more units from the Building Stack (vacant highlighted, occupied disabled with reason).
  4. **Terms**: contract date (shows day name live), start date, **first collection date** (with quick chips: same day / +1 month / +2 / +3 and computed grace label), term (chips 1/2/3/5 years + custom), auto-renew toggle, rent (MoneyInput with tafqeet preview), purpose (presets + free text), utilities party (SegmentedControl الطرف الأول / الطرف الثاني), fixed electricity amount, free months (investment), notice period, security deposit, annual increase.
  5. **Clauses**: live rendered list; toggle optional clauses; edit text of any clause for this contract; add custom clauses; drag to reorder custom ones.
  6. **Review**: A4 preview exactly as printed (scaled), summary of schedule (first 6 charges), warnings (overlap, civil ID checksum, first collection before start).
  7. **Finish**: "Save as draft" or "Activate" (generates charges) → then Print / Download PDF / Upload signed scan.
- Contract page: header (status, number, tenant, units, rent), timeline (created, activated, notices, revisions, payments, renewal), schedule table with statuses, balance, actions (Print, Record payment, Record notice, Revise rent, Renew, Terminate, Upload signed copy, Duplicate).

### 10.6 Collections (the daily workhorse)
- Top: MonthPicker + property selector (or "All properties" grouped).
- Spreadsheet-like table **identical in columns to the paper statement** (§6.6) plus a status pill column.
- Each row: tap → **Record payment sheet**: amount (defaults to amount due incl. arrears; quick chips "This month", "All due", "Custom"), method, date (default today), receipt number (manual, with duplicate warning), reference, collected by, allocation preview (which periods get covered, with editable override), note, attach photo. Save → toast with "Print receipt" / "Send WhatsApp confirmation".
- Bulk: select rows → "Mark as fully paid" (one payment each, same date, receipt numbers entered inline in a mini table).
- Sticky footer totals: expected, collected, previous/next, arrears.
- Actions: Print statement, Export Excel, Close month (admin/accountant; locks period).
- Mobile: card list version for collectors in the field (big tap targets, one-handed).

### 10.7 Payments / receipts
List with filters and search; receipt page; void with reason; print receipt (A5/A4 half, Arabic, amount in words, org letterhead, receipt number, tenant, unit, period(s) covered, method, collector signature line).

### 10.8 Expenses
- List with filters (period, property, category, beneficiary, status).
- **New voucher** form: header fields; line editor (add line → category, beneficiary with inline create, description, amount, allocation mode with visual split preview bars per property); total with tafqeet; attachments (camera capture on mobile). Post / save draft.
- Print voucher replicating the paper سند صرف: header box دينار / فلس, voucher no, date, "مبلغ وقدره" in words, notes; per line block: amount (دينار + فلس columns), type, beneficiary, description, owner, property, unit, floor, paid from (الصندوق / البنك-النقدية / الشيك); recipient name + signature.
- Recurring expenses page with "Generate for month" action.

### 10.9 Deposits
List + create sheet; monthly **cover summary** view (§6.8) with reconciliation; print cover sheet.

### 10.10 Legal
Board view (columns by status) and list view; case page with timeline; next hearings calendar list.

### 10.11 Reports hub
Grid of report cards (icon, title, one-line description). Each report page: parameter bar (period presets: this month, last month, this quarter, last quarter, H1/H2, this year, last year, custom; property; owner), on-screen result with charts, and buttons **Print / PDF** and **Excel**. Excel files: RTL sheet, styled header, number format `#,##0.000`, frozen header, totals row, one sheet per property for multi-property reports.

### 10.12 Owner portal
Separate simplified shell: owner's properties, monthly statements, accounting reports, deposits received, documents. Read-only. Invite owners from owner page (magic link).

### 10.13 Settings
Organization (name AR/EN, logo, letterhead toggle, accent color), Users & roles (invite by email, role, deactivate), Templates (versioned clause editor with live preview and variable picker), Expense categories, Beneficiaries, Numbering formats, Billing rules (proration, allocation strategy, due day), Reminder message template, Preferences (language, theme, digits, density), Data export (full CSV/Excel export of all tables), Month closing management.

### 10.14 Audit log
Filterable list: who, what, when, before/after diff viewer.

---

## 11. INTERNATIONALIZATION
- `ar` default with `dir="rtl"`, `en` with `dir="ltr"`, switcher in settings and in the account menu; persisted per user.
- Every string in `messages/ar.json` and `messages/en.json` (no hard-coded UI text). Include unit types, statuses, categories (DB stores both `name_ar` and `name_en`).
- Print documents follow the document language chosen at print time (default Arabic).
- Numbers: Western digits default; Arabic-Indic optional.

---

## 12. SECURITY & PRIVACY
- Civil IDs and phones are personal data: mask civil IDs in lists (`2530••••0043`), full value only on detail pages for admin/accountant.
- All storage private, signed URLs (5 min).
- Server actions validate with zod and check role server-side (never trust client).
- RLS on every table; service role key only used in server-only code for cron.
- Rate-limit auth endpoints. CSRF protection via server actions defaults.
- Audit everything financial. Voids instead of deletes for financial records.

---

## 13. PERFORMANCE
- Server Components for data pages; client components only where interactive.
- Indexed columns: `org_id` + foreign keys + `period`, `received_at`, `status`.
- Dashboard queries aggregated in SQL views/RPCs, not in the browser.
- Table virtualization for large lists. Lighthouse ≥ 90 performance and ≥ 95 accessibility on dashboard (production build).

---

## 14. TESTING
- **Unit (Vitest)**, required coverage ≥ 90% for `src/domain/**`:
  - money (splits always sum exactly), tafqeet (≥ 40 cases), dates/day names, validation, schedule (grace, free months, proration, revisions, end/move-out), allocation (FIFO, partial, advance credit, manual override, void), ledger (statuses, arrears carry-forward, aging), expenses allocation (all modes, remainder fils), contracts (penalty rules, renewal, notice), templates (conditions, sections, renumbering, clause_ref), reports (statement totals and the Jabriya validation dataset, accounting KPIs).
- **E2E (Playwright)** smoke against the dev server with seeded data (skip gracefully with a clear message if Supabase is not running): login → dashboard renders widgets → record a payment → statement arrears update → create an investment contract via wizard → print route renders → create a voucher split across two properties → reports load and Excel downloads.
- **RLS tests** per §7.1.

---

## 15. SEED / DEMO DATA (`supabase/seed.sql` + a TS seeder `pnpm seed`)

Use **fictional names and IDs** (never real personal data), but the **exact structure and amounts** below so reports can be verified against the client's paper documents.

- Org: "مكتب الواحة لإدارة العقارات" (fictional demo office).
- Users: admin@demo.test, accountant@demo.test, collector@demo.test, owner@demo.test (password `Demo12345!`, document in README).
- Owner A (fictional), owns **الجابرية 157** (residential/mixed) and **الري قسيمة 1674** (industrial/investment). Owner B owns **صباح السالم قطعة 12 منزل 43** (residential).
- **Jabriya 157, August 2026** units and figures (unit label → rent / collected):
  واحد 300/300 · اثنين 300/300 · ثلاثة 450/450 · أربعة 500/500 · خمسة 300/300 · ستة 300/300 · سبعة 300/300 · ثمانية 300/300 · **تسعة 320/300** · عشرة 310/310 · أحد عشر 300/300 · اثنا عشر 320/320 · ثلاثة عشر 300/300 · أربعة عشر 320/320 · خمسة عشر 300/300 · ستة عشر 300/300 · سبعة عشر 310/310 · ثمانية عشر 300/300 · تسعة عشر 310/310 · **عشرون 300/250** · واحد وعشرون 270/270 · **22, 23, 24 (one contract) 2,150/2,150** · غرفة 100/100 · محل: خالية · نصف السرداب الأمامي: خالية · نصف السرداب الخلفي: خالية · السطح: خالية.
  Units 21, 22–24 and the room belong to the same tenant (three contracts or one multi-unit + separate; use: contract A = unit 21, contract B = units 22,23,24, contract C = room).
  Payment dates spread 01/08–25/08/2026, receipt numbers 4–5 digit non-sequential.
  **Expected**: Σ rent 8,960.000 · Σ collected 8,890.000 · arrears 70.000 · 4 vacant units.
- July 2026 fully paid for all Jabriya units (so arrears start in August only). September 2026: generate charges; record ~70% of payments to make the dashboard lively.
- **Expense voucher** 26/08/2026, total 195.000: line 1 راتب شهري 170.000 → beneficiary "محمد (حارس)" (fictional), description "راتب شهر أغسطس 2026", property Jabriya 157; line 2 مصاريف صيانة 4.750 → vendor "العمارتين", "تصوير عداد الكهرباء الجابرية والسالمية", **split_even between Jabriya 157 and a Salmiya property**; line 3 مصاريف صيانة (or وقود) 20.250 → asset "السيارة فورد", "فاتورة بنزين للسيارة الفورد", property Jabriya 157.
- Add a **Salmiya** property with 10 units and August collections that bring the org-wide August total to **17,475.000**, plus a **deposit** of **17,280.000** dated 29/08/2026 → cover summary: collected 17,475.000, deposits 17,280.000, expenses 195.000, difference 0.000.
- **Residential contract** (Sabah Al-Salem, apartment 3, rent 400.000, contract date 01/02/2026 Sunday, start 01/02/2026, 5 years, utilities on owner, family residence, notice 2 months).
- **Investment contract** (Al-Rai plot 1674, shop 8, rent 650.000, contract date 01/10/2026 Thursday, start 01/10/2026, 5 years, auto-renew, purpose "مكتب عقاري", utilities on owner with fixed electricity 3.750 monthly, 2 free months → first collection 01/12/2026, notice 1 month, industry authority clause on).
- One tenant with a legal case (status منظورة) and 3 months arrears; one contract expiring in 45 days; one tenant with an advance payment covering 2 future months.

---

## 16. BUILD PHASES (execute sequentially, without stopping)

Each phase ends with the quality gate (§0.4), updating `PROGRESS.md`, and a commit.

**Phase 0 — Bootstrap**
Copy any reference images found next to CLAUDE.md (`design-references/*`) into `docs/design/references/`. Create Next.js 15 app (TS, App Router, Tailwind v4, ESLint), pnpm, Prettier, Vitest, Playwright, next-intl with `ar`/`en` and RTL, fonts, `docs/` files, `.env.example` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `NEXT_PUBLIC_APP_URL`), scripts: `dev`, `build`, `start`, `typecheck`, `lint`, `test`, `test:e2e`, `db:reset`, `db:types`, `seed`. Supabase CLI init.
DoD: app boots, `/ar` renders RTL, gate green.

**Phase 1 — Domain core (pure logic, test-first)**
Implement `src/domain/*` (§5, §6, §8 engine) with full unit tests including the Jabriya validation dataset as an in-memory fixture.
DoD: coverage ≥ 90% on domain, gate green.

**Phase 2 — Database**
Migrations for §7 (enums, tables, constraints, triggers, functions, views, RLS, storage buckets), seed data §15, generated types. RLS tests.
DoD: migrations apply on `supabase db reset` (or documented fallback), types generated, gate green.

**Phase 3 — Brand, design system & shell**
Brand identity per §18 first (logo mark, wordmarks, palette, master SVGs, asset generation script, `docs/BRAND.md`), then tokens, themes, all primitives in §9.3, AppShell (sidebar + tab bar), LargeTitleHeader, CommandPalette, auth pages (login, magic link, reset) styled Apple-like, locale switcher, a `/[locale]/dev/ui` gallery page showing every component in light/dark, RTL/LTR (admin only).
DoD: gallery renders all components, gate green.

**Phase 4 — Master data**
Owners, properties (with Building Stack), bulk unit creation, units, tenants, beneficiaries, expense categories. CRUD with zod validation, optimistic UI, toasts, empty states, search, filters.
DoD: full CRUD works against Supabase, gate green.

**Phase 5 — Contracts**
Template engine integration, seed templates in DB, wizard (all 7 steps), contract page, lifecycle actions (activate, notice, revise rent, renew, terminate with penalty and deposit settlement), signed-scan upload, print route.
DoD: both seed contracts print exactly per §8 with correct day names, tafqeet and numbering; gate green.

**Phase 6 — Billing & collections**
Charge generation (idempotent + cron route), collections sheet (desktop table + mobile cards), record payment sheet with allocation preview/override, bulk mark paid, receipts (print), voids, adjustments, credits, month closing & period lock, tenant ledger, WhatsApp reminders.
DoD: Jabriya August statement on screen and print matches §15 exactly; gate green.

**Phase 7 — Expenses & deposits**
Vouchers with multi-line allocation, print voucher (paper replica), recurring expenses, deposits, cover summary with reconciliation.
DoD: seed voucher prints 195.000 with correct words; cover summary 17,475 / 17,280 / 195 / 0; gate green.

**Phase 8 — Dashboard**
All widgets in §10.1, filters, reorder/hide persisted, animations, skeletons.
DoD: dashboard renders with seed data, no layout shift, gate green.

**Phase 9 — Reports**
All reports §6.10 with on-screen, print and Excel; reports hub.
DoD: every report renders with seed data; Excel opens with correct formats; gate green.

**Phase 10 — Legal, owner portal, settings, audit**
Legal module, owner portal with invites, all settings pages (template editor with versioning), audit log with diff viewer, full data export.
DoD: owner user sees only own properties (RLS verified), gate green.

**Phase 11 — PWA, offline & notifications**
Everything in §19: manifest, icons and splash screens, Serwist service worker, install experience (Android prompt + iOS guide), offline collections with outbox and background sync, web push (VAPID, subscriptions, all event types, preferences, quiet hours, digests), in-app notification center with Realtime, app badge, update flow, app shortcuts, share target.
DoD: Lighthouse PWA installable checks pass; a payment recorded offline syncs after reconnect with no duplicate; a test push arrives on a subscribed browser; gate green.

**Phase 12 — Polish & QA**
Apply the §20 quality bar. i18n completeness check (script that fails if any key is missing in either locale), RTL visual review of every page (fix mirrored icons, alignment), accessibility pass, dark mode pass, mobile pass (375px), performance pass, Playwright e2e suite, README (setup, env, Supabase, seed, deploy to Vercel, cron), final `PROGRESS.md`.
DoD: §17 checklist all true.

---

## 17. FINAL ACCEPTANCE CHECKLIST

- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` green; e2e green (or skipped with documented reason).
- [ ] Jabriya 157 August 2026 statement: rent 8,960.000, collected 8,890.000, arrears 70.000 (unit 9 = 20.000, unit 20 = 50.000), four vacant rows labeled خالية; print matches the paper column order.
- [ ] Cover summary August 2026: 17,475.000 / 17,280.000 / 195.000, difference 0.000.
- [ ] Voucher 195.000 prints with "فقط مائة وخمسة وتسعون دينار لا غير" and the meter-photocopy line split between Jabriya and Salmiya.
- [ ] Residential contract prints: "انه في يوم الأحد الموافق 01/02/2026", 13 or fewer numbered clauses with correct renumbering, clause referencing term by number.
- [ ] Investment contract prints: "الخميس الموافق 01/10/2026", rent in words "ستمائة وخمسون", electricity 3.750 in words, free months sentence, first collection 01/12/2026, duplicate fresh-water clause merged.
- [ ] Free months appear as concessions in the accounting report; early termination before 12 months proposes the penalty.
- [ ] Partial payment creates arrears that carry into next month; overpayment becomes credit consumed by next month's charge.
- [ ] Overlapping contract on the same unit is rejected with a clear Arabic message.
- [ ] Late units, vacant units, accounting (quarter & year), owner statement, tenant ledger, expiring contracts, expense reports all render, print and export to Excel.
- [ ] Owner portal user sees only their properties; collector cannot open expenses.
- [ ] Every screen correct in Arabic RTL and English LTR, light and dark, 375px mobile and 1440px desktop.
- [ ] No hard-coded UI strings, no TODOs, no dead buttons, no console errors.
- [ ] App installs from Chrome (Android/desktop) and via Add to Home Screen on iOS; opens standalone with branded splash, correct icons, safe-area handling and no browser chrome.
- [ ] Offline: collections sheet for the current month opens without network; a payment recorded offline syncs once, with no duplicate, and shows sync state.
- [ ] Push: a subscribed user receives a bilingual notification (in their language) for a recorded payment and for the daily late-rent digest; tapping it deep-links to the right screen; quiet hours are respected.
- [ ] In-app notification center updates live; app icon badge shows unread count where supported.
- [ ] Brand: logo, wordmarks, icons, splash, OG image, auth emails, print letterhead and empty-state illustrations are all original, consistent and present in both languages; `docs/BRAND.md` exists.
- [ ] UI matches the §21 photo-led glass direction and the reference boards: photo heroes with scrims, glass controls, Ink pill buttons, floating pill tab bar, icon chips, histogram slider; data screens stay photo-free and dense.
- [ ] Every item in §20 quality bar met (Lighthouse targets, visual regression baselines, zero console errors).
- [ ] `docs/PROGRESS.md` fully checked; `docs/DECISIONS.md` lists all assumptions.

---

## 18. BRAND IDENTITY — "إيجاري | Ejari"

Design the brand **before** the design system (Phase 3). It must be original, ownable and equally beautiful in Arabic and English. Nothing generic: no stock house-with-roof icons, no key clip-art, no default Tailwind blue. The visual direction in §21 governs how the brand is expressed in the UI.

### 18.1 Concept
- **Name**: **إيجاري** (Ejari), "my rent / my lease". Instantly understood by every Kuwaiti owner and tenant, possessive and personal, describes exactly what the product does. English name **Ejari**, pronounced *eh-JAA-ree*; website **ejarikw.com**.
- **Idea**: *"Every door, accounted for."* / *"كل باب… في مكانه."* The product turns a building full of doors into one calm, precise ledger.
- **Symbol**: the **arched doorway** of Gulf architecture. Inside the arch, the door opening is drawn as the letter **ا** (alif, the first letter of إيجاري) as a tall vertical slot, with the **hamza** of إ as a small precise mark beneath the threshold. Read together: a door, and the start of the name. Built from circles and straight lines only, so it holds up from a 16px favicon to a billboard.
- **Naming note (updated by client 2026-09-30)**: the English name is **Ejari** and the domain is **ejarikw.com**. Dubai's government tenancy system is also called Ejari (إيجاري): never use Dubai/RERA colors or styling; the client should run a Kuwait trademark check before launch (logged in `docs/DECISIONS.md`).
- **Personality**: trustworthy, calm, precise, quietly premium, hospitable. A well-run family office, not a startup.

### 18.2 Logo system (hand-written, optimized SVG; no raster, no live fonts inside the mark)
Create in `public/brand/`:
- `mark.svg` (primary symbol), `mark-mono.svg` (currentColor; badges, favicons, print).
- `lockup-ar.svg`: mark + **إيجاري**, horizontal, mark on the **right**.
- `lockup-en.svg`: mark + **Ejari**, horizontal, mark on the left.
- `lockup-bilingual.svg`: mark with **إيجاري** above **Ejari**, stacked (splash, login, letterhead).
- `wordmark-ar.svg`, `wordmark-en.svg`: glyphs converted to outlined paths. Arabic based on IBM Plex Sans Arabic Bold; the alif of إ is drawn slightly taller to echo the door slot in the mark, and the final ي tail is kept short and flat so the word sits calmly on the baseline; English "Ejari" on Inter Semibold, tracking −2%, with the dot of the first i replaced by a tiny arch.
Document in `docs/BRAND.md`: clear space (= the arch's inner opening height), minimum sizes (mark 16px, lockup 96px), do/don't (no stretching, outlines, shadows or off-palette colors).

**App icon**: white mark centered on an **Ink squircle** (see palette), with a faint warm light gradient inside the arch opening, like light through a doorway at dusk. Mark ≈ 58% of icon width. Maskable variant keeps the mark within the 80% safe zone.

### 18.3 Brand palette (feeds the tokens in §9.2 and §21; Apple semantic status colors stay)
| Token | Light | Dark | Use |
|---|---|---|---|
| `--brand-ink` | `#0E0F12` | `#F5F5F7` | **Primary action color**: primary pill buttons, active chips, active tab, toggles "on" (as in the references: black pills on light, white pills on dark) |
| `--brand-paper` | `#FFFFFF` | `#1C1C1E` | Cards, sheets |
| `--brand-mist` | `#ECEEF2` | `#0B0B0D` | App background (cool soft gray, never pure white) |
| `--brand-dusk` | `linear-gradient(180deg, #C9D4E3 0%, #D8CCD6 100%)` | `linear-gradient(180deg, #1A1F2B 0%, #241C24 100%)` | Onboarding/login/marketing backdrop: the soft blue-to-mauve sky from the references |
| `--brand-sand` | `#C9A66B` | `#D9B77C` | Premium highlight: owner portal, 100%-collected celebration. ≤ 5% of any screen |
| `--brand-gulf` | `#2F5BFF` | `#5B7FFF` | Links, focus rings, selected text, chart series 1. Never used for big filled buttons |
| `--brand-rose` | `#F0508C` | `#FF6FA3` | Rare single emphasis (e.g. "Record payment" floating action on the unit hero, favorite/pin). At most one per screen |
Chart series order: gulf, ink (60%), sand, teal, gray. Users may change the accent in settings; primary buttons stay Ink.

### 18.4 Typography
- Arabic **IBM Plex Sans Arabic**; English **Inter** (use Inter Display optical sizing for ≥ 28px). Numerals always Inter with `tnum`.
- Headlines follow the references: large, tight (line-height 1.1), with **weight contrast inside one headline** ("Explore **Modern Living**" → "إدارة **عقاراتك** بهدوء" / "Your buildings, **calmly managed**"): regular + semibold in the same line.
- Wrap mixed-script runs (Arabic sentence with amounts, civil IDs, unit numbers) in `<bdi>` / `unicode-bidi: isolate`.

### 18.5 Voice & tone (author both languages; neither is a literal translation)
- Arabic: Modern Standard Arabic, warm, polite, Gulf-friendly vocabulary (إيجار، محصل، متأخرات، خالية، سند صرف), short sentences, imperative buttons ("سجّل دفعة"، "اطبع الكشف").
- English: plain, calm, confident ("Record payment", "3 units are late").
- Numbers first: "٧٠٫٠٠٠ د.ك متأخرات على وحدتين" / "70.000 KWD overdue across 2 units".
- Empty states encourage and point to one action ("لا توجد وحدات متأخرة هذا الشهر. عمل رائع." / "No late units this month. Nicely done.").
- Errors say what happened and what to do; no raw codes in the UI.
- Keep a bilingual microcopy glossary in `docs/BRAND.md`.

### 18.6 Brand applications (all required)
- Favicons (`favicon.ico` 16/32/48, `icon.svg` adapting to dark mode), `apple-touch-icon` 180px.
- PWA icons per §19.1; **iOS splash screens** for all current iPhone/iPad sizes, light and dark, generated by `scripts/generate-brand-assets.ts` (`sharp`) from the master SVGs: dusk gradient background, centered bilingual lockup.
- **In-app launch animation** (≤ 700ms, skipped under reduced motion): arch stroke draws in, fills, wordmark fades up, cross-fade to app. SVG + motion only.
- **Open Graph** image 1200×630 per locale (`opengraph-image.tsx`).
- **Onboarding & login** exactly in the spirit of the references: full-bleed architecture photograph, dark gradient fade at the bottom, large headline, one-line subtitle, page dots, white pill "ابدأ / Get started" + glass pill "تسجيل الدخول / Login".
- **Empty-state illustrations**: 10 custom SVG line illustrations, one style (1.75px strokes, rounded caps, ink lines, one sand accent, the arch motif recurring): no properties, units, tenants, contracts, payments, expenses, notifications, offline, and celebratory "no late units" / "no vacant units".
- **Arch pattern**: subtle geometric pattern from the arch (mashrabiya feel), ≤ 4% opacity, only on print cover sheets and the login backdrop.
- **Print letterhead**: bilingual lockup + org name (AR/EN) + thin ink rule; org logo may replace or sit beside the mark ("Powered by Ejari / بواسطة إيجاري" footer toggle).
- **Transactional emails** (Supabase Auth: invite, magic link, reset, email change): branded, bilingual (Arabic RTL first, English below), table-based, dark-mode friendly, in `supabase/templates/`, wired in `config.toml`.
- **Celebration**: when a property hits 100% collected for the month, a sand shimmer sweeps the ring widget once, plus a light haptic on Android.
- **Brand page** `/[locale]/dev/brand`: logos, palette with contrast ratios, type scale, icons, illustrations, photography rules, voice examples.

### 18.7 Bilingual excellence
- Design Arabic first, then verify English. Neither may look translated.
- Layout mirrors via `dir`. Charts in RTL keep time flowing right→left (newest on the left); record in DECISIONS.md. Tooltips and sheets open toward the reading direction.
- ICU messages in next-intl including all 6 Arabic plural forms (zero, one, two, few, many, other).
- Language per user; print language per document; notifications in each recipient's language.

---

## 19. PWA, OFFLINE & NOTIFICATIONS

### 19.1 Installability
- `app/manifest.ts`: `name "إيجاري | Ejari"`, `short_name "إيجاري"`, `lang "ar"`, `dir "rtl"`, `id "/"`, `scope "/"`, `start_url "/ar/dashboard?source=pwa"`, `display "standalone"`, `display_override ["window-controls-overlay","standalone"]`, `orientation "any"`, `background_color #ECEEF2`, `theme_color` light `#ECEEF2` / dark `#0B0B0D` (also as `<meta name="theme-color" media=…>`), `categories ["business","finance","productivity"]`.
  - Icons: 192/512 `any`, 192/512 `maskable`, monochrome 96.
  - `shortcuts`: سجّل دفعة / Record payment, تحصيل هذا الشهر / This month's collections, سند صرف جديد / New voucher, الوحدات المتأخرة / Late units (each with a 96px icon).
  - `screenshots`: 3 narrow + 2 wide, Arabic, captured by Playwright from seeded data (`scripts/capture-screenshots.ts`) with `form_factor`.
  - `share_target`: accept images and PDFs (`POST /share`) → "Attach to…" sheet (payment, voucher, contract, unit).
- iOS: `apple-mobile-web-app-capable`, status bar `black-translucent`, title `إيجاري`, startup images from §18.6.
- **Install experience**:
  - Android/desktop: capture `beforeinstallprompt`; show a branded, dismissible install card on the dashboard from the 2nd session (never first visit), plus "Install app" in settings.
  - iOS Safari (not standalone): bottom sheet with a 3-step illustrated guide (Share → Add to Home Screen → Add), explaining that iPhone notifications need the installed app (iOS 16.4+).
  - Never show install UI when already standalone.
- Standalone polish: `viewport-fit=cover` and safe-area insets everywhere (tab bar, headers, sheets, hero images bleed under the status bar), `overscroll-behavior: none` on the shell with custom spring pull-to-refresh on lists, inputs ≥ 16px (no iOS zoom), no text selection on chrome, `touch-action: manipulation`.

### 19.2 Service worker (Serwist)
- Precache shell, fonts, brand assets, icons, onboarding photos, offline page.
- Runtime: pages/RSC `NetworkFirst` (3s) → cache; `/_next/static` `CacheFirst` immutable; Supabase Storage images `StaleWhileRevalidate` (200 entries, 7 days); data for offline handled by the app layer in IndexedDB.
- Branded offline page with illustration and "what works offline".
- Update flow: when a new SW waits, show a glass banner "تحديث جديد متاح — إعادة التحميل" / "Update available — Reload". Never reload mid-form.
- On sign-out: clear caches, IndexedDB and push subscription for that device.

### 19.3 Offline mode (collectors in the field)
- Offline dataset in IndexedDB (`idb`) for the user's accessible properties: properties, units, active contracts, tenants (name, phones, masked civil ID), current and previous month charges and balances, receipt-number history. Refreshed on open, on focus and every 10 min.
- Offline screens: collections (current month), unit/tenant quick view, **Record payment**, late units, reminders.
- **Outbox**: offline payments get a client `client_id` (uuid), appear instantly with a "pending sync" badge, balances update optimistically.
- Sync via Background Sync (`outbox` tag) where supported, else on `online`, focus and interval. Server action `syncPayments` is idempotent on `payments.client_id`. Per-item results; conflicts (contract ended, period closed, duplicate receipt) go to a "Needs review" list with fix/discard.
- Connectivity pill (glass, top): "أنت غير متصل — سيتم مزامنة ٣ دفعات" / "Offline — 3 payments will sync".
- Other writes are disabled offline with an explanation, not hidden.

### 19.4 Channels
1. **Web push** (installed PWA on iOS 16.4+, Android, desktop).
2. **In-app notification center** (bell as a round glass button in the header, as in the references): grouped Today / This week / Earlier, unread dots, mark all read, swipe to dismiss, type filters, live via Supabase Realtime.
3. **App badge** (`navigator.setAppBadge`) = unread count.
4. Optional **email digest** (daily/weekly), branded.

### 19.5 Events (bilingual, recipient's language, deep link to the exact screen)
| Event | Recipients | Channel |
|---|---|---|
| Payment recorded (amount, unit, collector) | admin, accountant, owner of that property | push + in-app |
| Offline payment synced / needs review | the collector | push + in-app |
| **Daily digest** 09:00 Kuwait: due today, late count and total, top 3 late | admin, accountant, collector | push |
| Tenant late 3 / 7 / 15 / 30 days (configurable) | admin, accountant, collector | push + in-app |
| Grace period ends in 7 days | admin, accountant | in-app |
| Contract expires in 90 / 60 / 30 days | admin, accountant | push + in-app |
| Notice to vacate recorded | admin, accountant, owner | push + in-app |
| Unit became vacant | admin, accountant, owner | in-app |
| Legal hearing tomorrow | admin, accountant | push |
| Voucher above threshold (default 500.000) | admin, owner | push + in-app |
| Month-end: close month / unreconciled cash difference | admin, accountant | push |
| Deposit recorded | owner | push + in-app |
| Monthly statement ready | owner | push + email |
| Invited / role changed | the user | email |

Examples (ICU templates in `messages/*.json`):
- AR: `تم تحصيل ٣٠٠٫٠٠٠ د.ك — الجابرية ١٥٧، وحدة ٥. بواسطة محمد.`
- EN: `300.000 KWD collected — Jabriya 157, unit 5. By Mohammed.`
- AR digest: `اليوم: ٤ دفعات مستحقة، ٧ وحدات متأخرة بإجمالي ١٬٢٤٠٫٠٠٠ د.ك.`

### 19.6 Push implementation
- Env: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`; `scripts/generate-vapid.ts` prints a pair.
- Never prompt on load. A branded pre-permission sheet asks in context (after the first recorded payment, or from Settings → Notifications). On iOS non-standalone, explain that installing comes first.
- Store subscriptions; handle `pushsubscriptionchange`; delete on 404/410.
- SW `push`: title, body, `icon` 192, `badge` monochrome 96, `tag` (dedupe, e.g. one digest per day), `lang`, `dir`, `data.url`, actions where supported ("فتح/Open", "سجّل دفعة/Record payment"). `notificationclick` focuses an existing window and navigates, or opens one.
- `src/server/notify/`: `notify(event, payload)` → recipients by role and ownership → `notifications` rows → preferences, quiet hours, dedupe → `web-push` send (concurrency 10, retry with backoff).
- Scheduled events from `/api/cron/notifications` (Bearer `CRON_SECRET`; Vercel Cron hourly; decisions by Kuwait local time).
- Settings → Notifications: per event × channel toggles, quiet hours (default 22:00–08:00 Kuwait), digest time, per-property mute, "Send test notification".

### 19.7 Schema additions (include in §7 migrations)
```
push_subscriptions(org_id, user_id, endpoint unique, p256dh, auth, user_agent, locale, created_at, last_used_at, failed_count)
notifications(org_id, user_id, type, title_ar, title_en, body_ar, body_en, url, entity_type, entity_id, read_at, created_at, dedupe_key unique nullable)
notification_preferences(org_id, user_id, type, push bool, in_app bool, email bool)
user_settings(user_id, locale, theme, accent, digits, density, quiet_start, quiet_end, digest_time, dashboard_layout jsonb, install_prompt_dismissed_at, onboarding_done bool)
payments.client_id uuid unique nullable   -- offline idempotency
```
RLS: users access only their own subscriptions, notifications, preferences and settings.

---

## 20. QUALITY BAR ("highest possible quality")

Nothing ships below this bar. Verify in Phase 12 and fix everything that fails.

**Craft**
- 4px grid, consistent radii from §21, hairline separators (0.5px on retina).
- Every control has hover (pointer), pressed (scale .97), focus-visible and disabled states.
- Every async action: optimistic update or inline progress, success toast, inline recoverable errors.
- Skeletons match final layout (CLS ≈ 0); images have fixed aspect ratios and blur-up placeholders (`placeholder="blur"` / generated BlurHash for uploads).
- Micro-interactions: rolling counters, ring fills, sheet springs, list reorder, swipe actions, Android haptics, all off under reduced motion.
- Forms: smart defaults, autofocus, Enter submits, correct `inputmode` (decimal money, tel phones, numeric civil ID), validation after blur, drafts preserved.
- Tables: keyboard navigable, sticky header/footer, become cards on mobile.
- Dark mode designed, not inverted: every chart, photo overlay, illustration and status color checked.

**Performance** (production, mobile emulation, seeded data)
- Lighthouse: Performance ≥ 95, Accessibility 100, Best Practices 100, SEO ≥ 90 (public pages); PWA installable checks pass.
- LCP < 2.0s, INP < 150ms, CLS < 0.02 on dashboard and collections.
- ≤ 180KB gzipped JS per route (charts, exceljs, cmdk loaded dynamically). Photos via `next/image`, AVIF/WebP, responsive `sizes`. `backdrop-filter` limited to ≤ 4 simultaneous layers per viewport for scroll performance.

**Reliability**
- Zero console errors/warnings in e2e.
- Branded error boundaries per segment; designed `not-found` and `error` pages in both languages.
- Property-based tests (`fast-check`) for allocation and splitting invariants (sums exact, never negative).

**Visual regression**: Playwright baselines for onboarding, login, dashboard, collections, record-payment sheet, property hero + Building Stack, unit detail, contract wizard steps 1/4/6, contract print (both), voucher print, statement print, late units, notification center, iOS install guide, offline pill — each in **ar/en × light/dark × 390px/1440px** (`tests/e2e/__screenshots__/`).

**Accessibility**: WCAG 2.2 AA; axe-core in e2e with zero violations; text on photos always ≥ 4.5:1 via the scrim rules in §21; logical RTL focus order; 44px targets.

**Review ritual**: open every route at 390px and 1440px, both languages, both themes; compare side by side with the references in `docs/design/references/`; critique like a senior Apple designer; fix; repeat until nothing within scope can be improved. Record in `docs/DESIGN_REVIEW.md`.

---

## 21. VISUAL DIRECTION — "Photo-led glass" (overrides §9 where they differ)

The client chose a specific style. Three reference boards are in `docs/design/references/` (copy them there in Phase 0 if provided; otherwise follow this description exactly). The look: **real-estate editorial**. Architecture photography is the hero, UI floats on it as frosted glass, everything else is quiet white cards on a soft gray background, with black and white pill controls. It must still behave like a precise finance tool: photos lead on overview and detail screens, never on dense data screens.

### 21.1 Signature elements
1. **Full-bleed photo heroes** with a bottom scrim (`linear-gradient(to top, rgba(0,0,0,.55), rgba(0,0,0,0) 55%)`), white text on the scrim: onboarding, login, property detail, unit detail, owner portal home.
2. **Frosted glass controls** over photos: round icon buttons (44px, `backdrop-filter: blur(20px) saturate(160%)`, `background: rgba(255,255,255,.22)`, 1px `rgba(255,255,255,.35)` inner border), glass pills for metadata (location, price, rating-style chips → in Ejari: "٩ وحدات", "٩٦٪ محصل", "٣٠٠٫٠٠٠ د.ك/شهر").
3. **Pill buttons**: primary = Ink fill, white text, height 52, full-width in sheets; secondary = white fill, ink text; tertiary on photos = glass. Radius fully rounded (`9999px`).
4. **Floating tab bar** (mobile): a detached dark pill (`#0E0F12` at 92% + blur) floating 12px above the safe area, 4–5 round icon buttons; the active one is a white circle with an ink icon (reference 2), or active expands to icon + label pill (reference 1). Choose the icon + label variant for Arabic clarity. Content scrolls **under** it.
5. **Large rounded cards**: radius 28px (cards), 32px (hero images and sheets), 20px (inner tiles), 14px (inputs). Cards are white on Mist with no visible border and a very soft shadow (`0 1px 2px rgba(16,24,40,.04), 0 12px 32px rgba(16,24,40,.06)`).
6. **Property cards** (list & dashboard): photo fills the card, glass heart → becomes a **pin** (favorite property), bottom scrim with location line (pin icon + area), property name in 22px semibold, and a row of glass pills: occupancy %, monthly collected, arrears (red-tinted glass if > 0). A glass pill button at the bottom "عرض تفاصيل العقار ›" with a white circular chevron (mirrored in RTL).
7. **Chip selectors with icon circles** (reference 1): horizontal scroll of pill chips, each with a round icon on the leading side; active chip = Ink fill, white text, icon circle inverted. Used for unit types, property filters, report periods, dashboard property filter.
8. **Segmented pill groups** (reference 2 filters): light gray track, white raised thumb for the selection. Used for bedrooms-style numeric choices (term years, notice months, grace months), status filters, period presets.
9. **Histogram range slider** (reference 2): bars show distribution, selected range bars in ink, others light gray, dark value bubbles above the thumbs. Used for filtering units by rent and tenants by arrears amount, and in the vacant units report by asking rent.
10. **Bottom sheets over imagery** (reference 2): sheet with 32px top radius and grabber, the photo still visible behind it at the top. Filters, record payment, quick unit view.
11. **Headlines with weight contrast** ("إدارة **عقاراتك**"، "Explore **Modern Living**"), 32–40px on mobile, left/right aligned by direction.
12. **Greeting header** (reference 1): "مرحبًا، وائل" / "Hello, Wael", a small location/org switcher line with a chevron under it, round glass bell button on the trailing side. Below: search pill (full-width, 52px, white on Mist, leading search icon) + round filter button.
13. **Section headers**: title 20px semibold + trailing "عرض الكل / View all" text button.
14. **Thumbnail strips** inside cards (reference 1 detail): rounded 16px photo tiles for unit galleries; a vertical column of round icon tiles for amenities → in Ejari: bedrooms, bathrooms, area, floor, meters.
15. **Detail page pattern** (reference 1 & 3): hero photo top ~42% of viewport with glass back button and glass action button; content card overlapping the hero by 24px; tab pills (Ink active) for sections; sticky bottom bar with the key figure on the start side ("٣٠٠٫٠٠٠ د.ك /شهريًا") and the primary pill on the end side ("سجّل دفعة").

### 21.2 Mapping to Ejari screens
- **Onboarding** (first launch, 3 pages): full-bleed Gulf architecture photos; headlines: "كل باب… في مكانه" / "Every door, accounted for"; "تحصيل بلا أوراق" / "Collections without paper"; "تقارير يثق بها المالك" / "Reports owners trust". Page dots (active dot elongated). White pill "ابدأ" + glass pill "تسجيل الدخول".
- **Login**: same hero photo, form in a bottom sheet (mobile) or a white card beside the photo (desktop).
- **Dashboard (mobile)**: greeting header → search + filter → property chips → "أداء هذا الشهر" hero widget (ring + big number on a white card) → horizontally scrolling **property photo cards** → remaining widgets from §10.1 as white cards in a 2-column bento.
- **Dashboard (desktop)**: left/right sidebar in glass over Mist, bento grid, property photo cards as `md`/`lg` widgets.
- **Property detail**: hero photo with glass pills (units, occupancy, collected), overlapping content card, tab pills (نظرة عامة، الوحدات، العقود، الكشف، المصاريف، المستندات), sticky bottom bar (this month collected / expected + "اطبع الكشف").
- **Unit detail**: hero (unit photo, else property photo), amenity icon column (type, floor, area, rooms, meters), thumbnail strip, tenant card, 12-month status strip, sticky bar (rent/month + "سجّل دفعة" in Rose, the one emphasis on that screen).
- **Collections, reports, statements, vouchers, settings**: **no photos**. Clean white cards on Mist, pill filters, segmented controls, tables with generous row height (56px comfortable / 44px compact). Photo-led style is for places, not ledgers.
- **Filters**: bottom sheet over the current screen with segmented pill groups, histogram slider, toggles (ink when on), and a full-width Ink pill "عرض ٦٤ نتيجة / Show 64 results" with a live count.

### 21.3 Photography
- Properties and units support photo uploads (multiple, reorderable, first = cover), cropped to 4:5 (cards) and 16:10 (heroes) with focal point selection. Stored in a `media` Storage bucket (signed URLs), resized variants generated on upload (Supabase image transformation if available, else `sharp` in a server action) with BlurHash.
- **Fallback when a property has no photo**: a generated architectural cover (SVG) using the arch motif, the dusk gradient, and the property initials. Never a gray box.
- **Brand photography** for onboarding/login/empty marketing surfaces: in Phase 3, download 5–6 high-quality free-license photos (Unsplash or Pexels, modern Gulf/Middle-East residential architecture at golden hour or dusk, calm skies, no people, no visible brands), optimize to AVIF/WebP at 3 sizes, store in `public/brand/photos/`, and record source URL, photographer and license in `docs/CREDITS.md`. If downloading is not possible, generate high-quality SVG/CSS architectural scenes (layered geometric buildings, warm lit windows, dusk gradient sky) and note it in DECISIONS.md so real photos can be dropped in later.
- Photos always get the scrim when text sits on them; never place text on an unscrimmed photo.

### 21.4 Token overrides (apply on top of §9.2)
```
--bg-grouped: var(--brand-mist)
--accent: var(--brand-ink)             /* primary controls */
--link: var(--brand-gulf)
--radius-sm: 14px  --radius-md: 20px  --radius-lg: 28px  --radius-xl: 32px  --radius-pill: 9999px
--glass-bg: rgba(255,255,255,.22)  dark: rgba(28,28,30,.45)
--glass-border: rgba(255,255,255,.35) dark: rgba(255,255,255,.12)
--glass-blur: blur(20px) saturate(160%)
--tabbar-bg: rgba(14,15,18,.92)
--scrim-bottom: linear-gradient(to top, rgba(0,0,0,.55), rgba(0,0,0,0) 55%)
--shadow-card: 0 1px 2px rgba(16,24,40,.04), 0 12px 32px rgba(16,24,40,.06)
--control-h: 52px (primary pills, search), 44px (chips, round buttons)
```
Add to §9.3 primitives: `PhotoHero`, `GlassButton`, `GlassPill`, `PropertyPhotoCard`, `IconChip` + `ChipScroller`, `PillSegmented`, `HistogramRangeSlider`, `FloatingTabBar`, `StickyActionBar`, `ThumbStrip`, `AmenityColumn`, `GreetingHeader`, `OnboardingPager`, `CoverFallback`. Show all of them in the `/dev/ui` gallery over real photos and on plain Mist.

### 21.5 Guardrails
- Glass needs contrast: over bright photo areas, raise `--glass-bg` alpha or add the scrim; test with the lightest and darkest seed photo.
- Provide a `@supports not (backdrop-filter: blur(1px))` fallback (solid translucent fill).
- Data density wins on work screens: the collection sheet must still show all 10 statement columns on desktop without horizontal scroll at 1440px.
- The style must look native in Arabic: mirrored chevrons and back buttons, headline weight contrast works with Arabic words, chips scroll from the right.
