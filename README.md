# إيجاري | Ejari

Rental property management for Kuwait — contracts, monthly collection statements, payment
vouchers with multi-property allocation, deposits, legal cases, reports and an owner portal.
New offices can self-register through a first-run setup wizard, then learn the product with a
guided tour and a live activation checklist.

Arabic-first (RTL) with a full English interface, KWD with 3 decimals, installable PWA with
offline collections and web push. See `CLAUDE.md` for the full product specification, `docs/`
for progress, decisions and the domain glossary, and `docs/LAUNCH.md` for the go-live runbook.

## Stack

Next.js 15 (App Router, Server Components, Server Actions) · React 19 · TypeScript strict ·
Supabase (Postgres, Auth, Storage, RLS, Realtime) · Tailwind CSS v4 · next-intl (`ar`, `en`) ·
Vitest + Playwright · Serwist PWA · ExcelJS · Recharts (lazy) · Zustand-free, server-first.

## Requirements

- Node 20+ and `pnpm` (via `corepack enable`)
- Docker (for local Supabase) and the Supabase CLI
- Optional for push: VAPID keys (`pnpm vapid`)

## Local setup

```bash
pnpm install

# 1) Start local Supabase (this project uses ports 5532x; see docs/DECISIONS.md)
npx supabase start

# 2) Configure env
cp .env.example .env.local
# paste the anon key and service role key printed by `npx supabase status`

# 3) Migrate + seed (demo office, properties, contracts, August 2026 collections)
npx supabase db reset        # runs migrations + supabase/seed.sql
pnpm db:types                # regenerate src/lib/supabase/types.ts

# 4) Run
pnpm dev                     # http://localhost:3000/ar
```

Demo accounts (password `Demo12345!`): `admin@demo.test`, `accountant@demo.test`,
`collector@demo.test`, `owner@demo.test`.

`pnpm seed` regenerates `supabase/seed.sql` from `src/demo/demo-data.ts` and applies it
(needs `DATABASE_URL`, already set for the local port in `.env.example`).

## First-run experience

- `/{locale}/signup` — self-serve office registration (rate-limited; email confirmation in
  production, instant session locally when confirmations are off). Set
  `NEXT_PUBLIC_ALLOW_SIGNUP=false` to close registration.
- `/{locale}/setup` — five-step wizard for a signed-in account with no office: identity (AR/EN
  name + logo), preferences, an optional first property with auto-numbered units, then done.
- Guided tour (`?tour=1`) — eleven steps across dashboard, properties, collections, contracts,
  reports and install; runs once after setup, replayable from More, the account menu and ⌘K.
- Activation checklist — live on the dashboard until complete or dismissed; every row deep-links
  to the exact flow (property → units → tenant → contract → payment → team → install).
- Public legal pages `/privacy` and `/terms` (contact via `NEXT_PUBLIC_SUPPORT_EMAIL`).

## Scripts

| Script | Purpose |
|---|---|
| `pnpm dev` / `build` / `start` | Next.js dev / production build / server |
| `pnpm typecheck` · `pnpm lint` · `pnpm test` | TS, ESLint, Vitest (domain + i18n) |
| `pnpm test:coverage` | Vitest coverage (domain ≥ 90 %) |
| `pnpm test:rls` | Row-level-security suite against local Supabase (`SUPABASE_TEST=1`) |
| `pnpm test:e2e` | Playwright; resets and re-seeds the **local** DB first (skip with `E2E_NO_RESET=1`) |
| `pnpm test:e2e --update-snapshots=all` | Refresh the visual-regression baselines |
| `pnpm i18n:check` | Fails if any message key is missing in `ar`/`en` |
| `pnpm seed` · `pnpm db:reset` · `pnpm db:types` | Demo data, migrations+seed, generated types |
| `pnpm brand:assets` · `pnpm screenshots` | Regenerate brand icons/splashes · PWA screenshots |
| `pnpm vapid` | Print a VAPID key pair for web push |

## Database

- Migrations in `supabase/migrations/` (enums, tables, triggers, `next_number`, views,
  RLS policies, storage buckets). Every table carries `org_id` and RLS.
- Period locking: a closed `monthly_closings` period rejects writes unless reopened by an admin.
- Money is stored as integer **fils** (`bigint`); never floats. Dates are `date`; billing
  periods are `YYYY-MM`. Timezone is `Asia/Kuwait`.
- Auth emails are branded bilingual templates in `supabase/templates/`, wired in `config.toml`.
  For production, set `site_url`/`additional_redirect_urls` to `https://ejarikw.com` and point
  the templates at your hosted project.

## PWA, offline and push

- The app is installable (manifest, maskable icons, iOS splash screens, app shortcuts).
  Service worker (Serwist): NetworkFirst pages, CacheFirst static, branded offline page.
- Collections can be recorded offline: the outbox (`idb`) queues payments with a client UUID and
  syncs once via Background Sync / on reconnect; conflicts land in “Needs review”.
- Web push: run `pnpm vapid`, set `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
  `VAPID_SUBJECT`. Push requires HTTPS (localhost works for development) and, on iOS, the
  installed app (16.4+). Preferences, quiet hours and digests live in Settings → Notifications.
- Scheduled jobs are declared in `vercel.json` and secured with `CRON_SECRET`:
  `/api/cron/charges` nightly (materialize charges) and `/api/cron/notifications` hourly
  (dues, late tenants, expiring contracts, digests, per Kuwait local time).

## Deploy to Vercel

The full go-live runbook is `docs/LAUNCH.md`. Summary: create and link the Supabase project,
`npx supabase db push`, import the repo in Vercel with the env vars from `.env.example`
(`NEXT_PUBLIC_APP_URL=https://ejarikw.com`, `NEXT_PUBLIC_DEMO_ACCOUNTS=0`, real `CRON_SECRET`
and VAPID keys; `SENTRY_DSN` optional), deploy, then set the Supabase Auth site URL, redirect
URLs and branded email templates.

## Tests

- **Unit** (`tests/unit`): money, tafqeet (40+ cases), dates/day names, validation, schedule,
  allocation, ledger, expenses, contracts, templates, reports, account/checklist, i18n
  completeness — including the Jabriya 157 August 2026 validation dataset
  (8,960.000 / 8,890.000 / 70.000).
- **RLS** (`tests/rls`): cross-org isolation and role limits (owner sees only own properties,
  collector cannot open expenses).
- **E2E** (`tests/e2e`): signup → first-run wizard → guided tour → activation checklist, login,
  collections statement, record payment, contract wizard → activate → print, voucher split across
  properties, reports, PWA/offline sync, push payload, axe-core accessibility (WCAG 2.2 AA,
  light/dark, ar/en), and visual regression baselines (`tests/e2e/__screenshots__`,
  24 screens × ar/en × light/dark × 390/1440).
- E2E specs skip themselves when local Supabase is not running. The run re-seeds the local
  database for determinism (never against a remote project).

## Docs

- `docs/PROGRESS.md` — phase checklist and current state
- `docs/LAUNCH.md` — go-live runbook and pre-flight checks
- `docs/DECISIONS.md` — product/technical decisions and assumptions
- `docs/DOMAIN.md` — glossary and business rules
- `docs/BRAND.md` · `docs/CREDITS.md` — brand system and photo credits
- `docs/DESIGN_REVIEW.md` — QA/design review record
