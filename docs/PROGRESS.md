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
- [ ] Phase 12 — Polish & QA
