# Design Review — Phase 12

Method: every screen was reviewed against §20/§21 at 390px and 1440px, in Arabic and English,
light and dark (160 visual-regression baselines in `tests/e2e/__screenshots__/`), plus the
automated axe-core pass (`tests/e2e/a11y.spec.ts`, WCAG 2.2 AA, zero violations). Screens were
compared side by side with the reference boards in `docs/design/references/`.

## What was checked

| Area | Result |
|---|---|
| RTL mirroring (sidebar, sheets, chevrons, charts, tab bar, print) | Correct everywhere; Arabic flows right→left, English mirrors exactly |
| Photo-led glass direction (§21): heroes, glass pills, pill buttons, floating tab bar, chip scrollers | Matches the references; data screens stay photo-free and dense |
| Numbers: tabular figures, 3 decimals, currency label, tafqeet under money inputs | Correct; amounts never wrap mid-number |
| Print layouts: statement, voucher, contract (residential + investment), report | Match the paper forms; letterhead, QR, signature blocks, footer |
| Dark mode | Designed, not inverted; ring/ink flips, glass over photos stays legible, status colors re-tuned |
| Mobile 375–390px | No horizontal scroll; hit targets ≥ 44px; tab bar floats over content with safe-area padding |
| English | No leftover Arabic in chrome; property data stays in its own script wrapped as needed |

## Issues found and fixed

1. **Date inputs overlapped their calendar icon in RTL** (wizard step 4, payment sheet, report
   parameter bar). The input forced `dir="ltr"` while the icon used the logical `end` edge, so
   the text ran under the icon on the mirrored side. Removed the forced direction; the field now
   aligns to the reading direction of each locale with the icon in the trailing gutter.
   Evidence: `d-ar-light-wizard-4` before → after.
2. **Aging bucket labels rendered in the wrong order in Arabic** (`31–60` displayed as `60–31`)
   because number ranges are weak-direction runs in an RTL paragraph. Wrapped the ranges in
   LTR isolates (`U+2066 … U+2069`) in `src/messages/ar/enums.json`.
3. Screen-reader/contrast fixes from the axe pass (see Phase 12 changes): `--label-2` raised to
   80% alpha, text-safe status color tokens, ring label, heatmap `aria-label`s, larger onboarding
   dots, ink text on the rose button (5.3:1), avatar accessible name, 24px minimum link targets.

## Known, accepted limitations

- **Date-dependent widgets are masked in visual regression**: dashboard widgets (today, vacant,
  expiring, first collections, legal), which drift with the calendar. Everything else is pinned
  to seeded data (dashboard/collections to August 2026, late report `asOf=2026-08-31`).
- **Bundle budget**: the shared shell is 102 KB gzipped (React 19 runtime + intl + app shell);
  simple settings screens are 174–188 KB. Data-heavy screens (collections, tables, wizard) are
  199–243 KB after the Phase 12 work (from 360–432 KB). The remaining weight is the table stack
  (tanstack 12 KB), toasts (9 KB), class merging (8 KB) and page code; `recharts`, `exceljs`,
  `cmdk`, sheets/dialogs/menus/popovers/charts are already code-split. `.next/analyze` is
  available via `ANALYZE=true pnpm build` for future trims.
- Lighthouse on throttled mobile for the authenticated dashboard: Performance 75, Accessibility
  100, Best Practices 100, SEO 100 (TBT 20 ms, CLS 0, LCP 6.4 s). The LCP element is the first
  property photo (already `priority`/preloaded); on a local production server the remaining time
  is the on-demand `/_next/image` optimization of that photo over simulated slow 4G on first
  request, which a CDN caches in production. Accessibility and Best Practices are clean.

## Verdict

The UI matches the photo-led glass direction and behaves like a precise finance tool: photos on
overview and detail screens, calm white cards and dense tables on data screens. Nothing in scope
looks translated, mirrored, or inverted; no console errors in the e2e suite.
