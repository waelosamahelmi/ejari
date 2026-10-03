# Ejari — Build Progress

Resume rule: read this file first and continue from the first unchecked item.

- [x] Phase 0 — Bootstrap
- [x] Phase 1 — Domain core (237 tests, coverage ≥ 90 %)
- [x] Phase 2 — Database (migrations, RLS, seed, types; RLS suite: `pnpm test:rls`)
- [x] Phase 3 — Brand, design system & shell (Ejari brand, tokens, primitives, shell, auth, /dev/ui, /dev/brand)
- [x] Phase 4 — Master data (owners, properties + Building Stack, bulk units, units, tenants, categories, beneficiaries, documents, photos)
- [x] Phase 5 — Contracts (wizard, lifecycle, print; e2e wizard→activate→print green)
- [x] Phase 6 — Billing & collections (Jabriya Aug statement verified on screen + print; e2e green)
- [x] Phase 7 — Expenses & deposits (voucher 195.000 print verified; cover 17,475/17,280/195/0 verified; e2e green)
- [x] Phase 8 — Dashboard (13 widgets, filters, reorder/hide persisted, skeletons)
- [x] Phase 9 — Reports (10 reports: screen + print + Excel; e2e green)
- [x] Phase 10 — Legal, owner portal, settings, audit (legal board/list + case timeline, owner portal + magic-link invites, all settings pages incl. versioned template editor, audit log with diff viewer, full Excel data export; RLS: owner sees only own properties, collector blocked from expenses)
- [x] Phase 11 — PWA, offline & notifications (manifest with icons/shortcuts/screenshots/share target, Serwist SW with offline fallback + runtime caching, install card + iOS guide + Settings → Install, update banner, offline collections from cached pages with embedded payment contexts, IndexedDB outbox + Background Sync + needs-review sheet, connectivity pill, web push with VAPID + pre-permission sheet + Settings → Notifications (per-event channels, quiet hours, digest time, muted properties, test), hourly notifications cron with dedupe, share inbox; e2e: installable, offline payment syncs once with no reload, SW push)
- [x] Phase 12 — Polish & QA (i18n completeness gate + unit test, branded error/not-found/global-error pages, Sentry wiring (opt-in), pull-to-refresh, swipe actions, haptics, rolling counters, bundle work (charts/exceljs/cmdk/sheets/dialogs/menus/popovers/form sheets code-split; worst page 432→243 KB, 44 routes ≤ 180 KB), axe-core suite (0 violations, WCAG 2.2 AA, ar/en × light/dark), visual regression (20 screens × ar/en × light/dark × 390/1440 = 160 baselines), fast-check invariants, RTL/dark/mobile review (fixed date-field RTL collision + bidi aging ranges), Lighthouse (a11y/best-practices/SEO 100, dashboard perf 75 on throttled mobile — LCP is the local image optimizer, see DESIGN_REVIEW), README, `docs/DESIGN_REVIEW.md`)
- [x] Phase 13 — Launch readiness (self-serve signup (`/signup`) + first-run setup wizard (`/setup`: office identity, preferences, first property with auto-numbered units), routing for orgless accounts, custom guided tour (11 route-aware steps, replayable), live dashboard activation checklist, empty-office welcome state, password inputs across auth, public privacy/terms + robots/sitemap, `docs/LAUNCH.md`, signup e2e + a11y + visual screens)
- [ ] Post-launch (optional): trim data pages below 180 KB gzip; run Lighthouse against the deployed CDN.

## Final verification (2026-10-02)

- `pnpm typecheck && pnpm lint && pnpm test` green (257 unit tests).
- `pnpm build` green; `pnpm test:e2e` green (21/21, serial, re-seeded, incl. signup wizard + tour); `pnpm test:rls` green (9/9). Visual regression: 24 screens × ar/en × light/dark × 390/1440 = 192 baselines.
- August 2026 Jabriya statement: 8,960.000 / 8,890.000 / 70.000 with four خالية rows (e2e + print).
- Expiring/grace/concession/late/accounting/owner/ledger reports render, print and export (e2e).
- Offline payment queues and syncs exactly once; push renders in the recipient's language (e2e).
- Owner portal sees only own properties; collector blocked from expenses (RLS suite).

## Client change set (2026-10-03): Kuwait address + unit planner

- [x] Additive migration `20261003000001_property_governorate.sql`; generated types updated; seed properties carry governorates; شراء (capital) added to seed/new-office categories.
- [x] Kuwait governorate/area dataset (`src/data/kuwait-addresses.ts`, 6 governorates / 140 areas, PACI-sourced) with English labels and legacy fallback.
- [x] Pure unit plan generator (`src/domain/unit-plan.ts`) + schemas + server actions (`createPlannedUnits`, `createPropertyWithPlan` with cleanup).
- [x] UnitPlanner reused by the bulk-add sheet and the new 2-step create-property flow (details → units / add later); even-spread bulk action removed.
- [x] Governorate in property list/search/detail (localized `governorate · area`), maps query and edit form; legacy rows preserved.
- [x] Tests: unit-plan, kuwait-addresses, schemas, e2e `properties.spec.ts`; visual baselines refreshed for property/building-stack screens only.
- Verification: `pnpm typecheck && pnpm lint && pnpm test && pnpm build` green; `pnpm db:reset` + `pnpm db:types` green (types unchanged by regeneration); e2e `properties.spec.ts` 3/3 (uneven 14-unit building, governorate→area filtering, add-units-later via the bulk planner); full e2e suite 22/23 green — the login visual baselines only pass with `NEXT_PUBLIC_DEMO_ACCOUNTS=1` (the `.env.example` default), because the local gitignored `.env` sets it to `0`; all other visual baselines green.
