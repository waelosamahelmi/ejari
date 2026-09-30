# Decisions log

| Date | Decision | Reason |
|---|---|---|
| 2026-09-30 | Pinned Next.js 15.5 and TypeScript 5.9 (not TS 7). | TypeScript 7 (native) has no JS compiler API; Next 15 loads `next.config.ts` through it and crashes. |
| 2026-09-30 | Local Supabase runs on ports 5532x (API 55321, DB 55322, Studio 55323, Inbucket 55324). | Another local Supabase project on this machine already uses the default 5432x ports. |
| 2026-09-30 | Root `app/layout.tsx` is a pass-through; `[locale]/layout.tsx` and `print/layout.tsx` render their own `<html>`. | Print routes must have no app chrome and choose their own document language/direction. |
| 2026-09-30 | Brand name spelled **Ijari** in English (never "Ejari"). The client should run a Kuwait trademark check before launch. | Dubai's tenancy system is also called إيجاري ("Ejari"). |
| 2026-09-30 | Kuwaiti civil ID checksum: `check = 11 − (Σ digit×weight mod 11)`; remainders giving 10 or 11 are treated as "no valid check digit" → checksum warning. Checksum failure is a warning, never a block. | §5.4; legacy data may not validate. |
| 2026-09-30 | `notice_period_words` and `free_months_words` use the oblique dual ("شهرين", "سنتين") because they always follow a preposition or act as an object ("قبلها بشهرين", "منح الطرف الثاني شهرين"). `term_words` stays nominative ("خمس سنوات", "سنتان"). | Correct Arabic grammar on printed contracts. |
| 2026-09-30 | Fixed electricity charges start with the first collection month (not during free/grace months). | Grace = nothing is collected before the first collection date. |
| 2026-09-30 | Investment "fresh water" clause appears twice in the client's source contract (clauses 9 and 11); merged into one clause `fresh_water`. | §8.2 instruction. |
| 2026-09-30 | Industry-authority clause is optional; default ON when the property type is `industrial` (engine: `defaultCondition`). | §8.2. |
| 2026-09-30 | Monthly statement "القيمة الإيجارية" = all non-voided charges of the month for the contract (rent + fixed electricity + manual charges). "سداد أشهر سابقة/لاحقة" = the part of this month's receipts allocated to earlier / later periods; unallocated credit counts as "لاحق". | Keeps Σ collected = Σ receipts and arrears consistent. |
| 2026-09-30 | Arrears/statuses are computed "as of" a date using only payments received and adjustments dated on or before it, so historical statements are reproducible. | Statements must not change when later payments arrive. |
| 2026-09-30 | Charges are materialized through the current month + 3 (nightly job) so advance payments allocate to real future charges and "first collection" widgets have data. Arrears only count charges already due. | §6.4/§6.5. |
| 2026-09-30 | Demo: the multi-unit tenant has three contracts (A = unit 21, B = units 22/23/24, C = room). Salmiya 88 (10 flats, 7,585.000/month) and Al-Rai shop 5 (600.000) + Sabah apt 3 (400.000) make the org-wide August 2026 total 17,475.000. The 17,280.000 deposit (29/08) goes to the office bank with a per-property breakdown. The legal case (منظورة, 3 months arrears) is Al-Rai shop 3; the contract expiring in 45 days is Salmiya flat 4; the advance payer is the Sabah tenant (paid Sep + Oct + Nov on 03/09). | §15 leaves these choices open. |
