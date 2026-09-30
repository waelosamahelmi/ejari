# Ijari — Domain glossary & business rules

All business logic lives in `src/domain/*` (pure, no I/O, ≥ 90 % covered). The server loads rows and calls these functions, so every number on screen, in print and in Excel comes from one tested implementation.

## Glossary

| Arabic | English | Notes |
|---|---|---|
| عقار | Property | Building or plot (الجابرية 157) |
| وحدة | Unit | Apartment, shop, room, half-basement, roof… |
| المالك / الطرف الأول | Owner / Party 1 | |
| المستأجر / الطرف الثاني | Tenant / Party 2 | |
| عقد إيجار سكني / استثماري | Residential / Investment lease | |
| القيمة الإيجارية | Rent amount (monthly) | |
| المحصل | Collected | |
| متأخرات السداد | Arrears | computed, never typed |
| سداد أشهر سابقة / لاحقة | Payment for previous / future months | |
| رقم الإيصال | Receipt number | pre-printed books, not sequential; duplicates warn |
| سند صرف | Payment voucher (expense) | |
| إيداعات | Deposits | cash moved to bank / owner |
| حالة القضايا | Legal case status | لا يوجد = none |
| خالية | Vacant | |
| الرقم الآلي للعنوان | PACI number | 8 digits |
| بطاقة مدنية | Civil ID | 12 digits, checksum = warning |
| فترة سماح | Grace period | before first collection |
| أشهر مجانية | Free months | investment; penalty if tenant leaves within 12 months |
| تأمين | Security deposit | |
| فلس | Fils | 1/1000 dinar |

## Money (`money.ts`)
- Integer fils everywhere (Postgres `bigint`). `toFils`, `fromFils` (`8,890.000`), `formatKWD` (`د.ك` / `KWD`, optional Arabic-Indic digits).
- `splitEven` gives remainder fils to the first parts; `splitByWeights` uses largest remainder. Both always sum exactly (property-tested).

## Tafqeet (`tafqeet.ts`)
- `tafqeetKWD(195000)` → `فقط مائة وخمسة وتسعون دينار لا غير`. Noun forms: 1 دينار واحد, 2 ديناران, 3–10 دنانير, 11+ دينار; fils likewise (فلس/فلسان/فلوس).
- `amountWords` (number only, for contract sentences), `tafqeetDuration` (nominative / oblique), `wordsEN`.

## Dates (`dates.ts`)
- Business dates `YYYY-MM-DD`, periods `YYYY-MM`, zone Asia/Kuwait. End date = start + term − 1 day. Display `dd/MM/yyyy`.

## Schedule (`schedule.ts`)
- One charge per month per kind. Months before the first-collection month → `free` (amount 0, waived = rent). Rent from the first collection month; due on the 1st (first one on the first-collection date). Optional proration. Fixed electricity from the first collection month. Rent revisions and automatic increases applied per period. Stops at end date or move-out.

## Allocation (`allocation.ts`)
- FIFO: period → due date → kind (rent before electricity). Manual override and "choose periods" supported. Remainder = tenant credit, consumed by future charges.

## Ledger (`ledger.ts`)
- Everything "as of" a date (payments/adjustments after it are ignored).
- Arrears = Σ outstanding of charges due ≤ D. Days late = D − oldest unpaid due date. Aging buckets 0–30 / 31–60 / 61–90 / 90+.
- Period status: paid · partial · unpaid · due · advance · free · vacant · legal.

## Contracts (`contracts.ts`)
- Defaults: 60 months; residential notice 2 months, investment 1 month + auto-renew. Numbering `R-2026-0001` / `I-2026-0001`.
- Lifecycle draft → active → notice_given → ended | terminated | renewed.
- Early-exit penalty (investment): leaving before start + 12 months with free months → free_months × rent. Deposit settlement never negative.
- Unit status derived: legal > notice > in_grace > occupied > reserved > vacant.

## Templates (`templates.ts`)
- `{{var}}`, `{{#var}}…{{/var}}`, `{{^var}}…{{/var}}`, `{{clause_ref:key}}`; safe condition language (`==`, `!=`, `<`, `>`, `&&`, `||`, `!`, parentheses). Automatic renumbering after skipped/toggled clauses.

## Expenses (`expenses.ts`)
- Modes: single, split_even, split_by_units, split_by_rent, manual_percent, manual_amount. Allocations always sum to the line.

## Reports (`reports.ts`)
- Monthly statement (§6.6), cover summary with reconciliation (§6.8), late units, vacant units, accounting (GPR, vacancy loss, concessions, NOI, KPIs, comparison), owner statement, expiring contracts, first collections, expenses, payment heatmap, occupancy.
- Validation: Jabriya 157, August 2026 → rent 8,960.000 · collected 8,890.000 · arrears 70.000 (unit 9 = 20, unit 20 = 50) · 4 vacant. Org August: 17,475 / 17,280 / 195 / 0.
