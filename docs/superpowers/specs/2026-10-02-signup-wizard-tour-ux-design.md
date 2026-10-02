# Spec — Launch readiness: admin signup, first-run wizard, guided tour, UX polish

Date: 2026-10-02 · Status: approved by client · Scope: three workstreams, built in order.

## Problem

The product is feature-complete but has no way for a new office to create an account: users exist
only via seed data or an invite from inside an existing org. There is no in-app explanation of
the product for first-time users, and several launch-readiness gaps remain (legal pages, empty
states, auth polish).

## Workstream A — Admin signup & first-run setup wizard

### Routes

| Route | Behaviour |
|---|---|
| `/{locale}/signup` | Public, photo-led. Full name, email, password (show/hide), terms checkbox. On success with confirmations off → `/setup`; with confirmations on → "check your email" state. |
| `/{locale}/setup` | Signed-in users without an org membership. 5-step wizard. If the user already has an org → redirect to dashboard. Signed out → login (middleware). |
| `/{locale}/no-org` | Redirects to `/setup` (kept for old links/emails). |
| `/{locale}/privacy`, `/{locale}/terms` | Public bilingual prose pages, linked from signup and Settings → Org. |

`NEXT_PUBLIC_ALLOW_SIGNUP=false` hides the signup CTA and makes `/signup` redirect to login
(default: open).

### Signup action (`src/server/actions/auth.ts`)

`signUp({ name, email, password, locale })`:
- Fixed-window rate limit per IP + email (5 / 10 min).
- Zod: name 2–80, email, password ≥ 8, terms accepted.
- Supabase `signUp` with `data.full_name`, `emailRedirectTo` to
  `/{locale}/auth/callback?next=/{locale}/setup`.
- Errors mapped to friendly i18n keys (`email_taken` → link to login, `rate_limited`,
  `generic`). Never leak whether an email exists when confirmations are on.

### Setup wizard (`/{locale}/setup`)

Full-screen photo/dusk experience (reuses the auth backdrop and onboarding aesthetics),
progress dots, Back/Next, skip on optional steps, client component with server actions.

1. **Welcome** — greets by name, lists the three quick steps.
2. **Office identity** — Arabic name (required, ≥ 2), English name (optional), logo upload
   (optional, `branding` bucket via existing upload helper).
3. **Preferences** — interface language, digits (Western/Arabic-Indic), theme
   (light/dark/system), density. Writes `user_settings`.
4. **First property** (optional) — name, area, block, street, unit count (1–200), asking rent;
   creates the property and numbered units (4 per floor from floor 1). "Skip for now" always
   visible.
5. **Done** — confirmation with a summary and the primary "Start using Ejari" button, which
   redirects to `/dashboard?tour=1`.

`completeSetup({ name, nameEn, logoData?, prefs, firstProperty? })`:
- Requires an authenticated user **without** an active membership (guards double submits).
- `create_org` RPC (already exists; makes the caller admin).
- Seeds the default expense categories and org `settings` defaults (numbering, due day 1,
  FIFO allocation, receipt duplicate policy warn, letterhead on).
- Applies preferences to `user_settings`; uploads the logo to `branding` when provided.
- Creates the optional first property + bulk units.
- Marks `user_settings.onboarding_done = true`; returns `{ orgId }`.

The existing `createOrganization` / `no-org` form is replaced by this flow (action removed or
delegated to `completeSetup`).

### Data

New migration `supabase/migrations/20261002000001_onboarding.sql`:
```sql
alter table public.user_settings
  add column tour_done_at timestamptz,
  add column checklist_dismissed_at timestamptz;
```
Regenerate `src/lib/supabase/types.ts`; extend `UserPrefs` in `src/lib/auth.ts`.

### Root/layout routing

- Root `/{locale}`: signed out → welcome/login as today; signed in with no org → `/setup`;
  with org → dashboard/portal. This needs an auth-user check that does not depend on
  membership (`getSessionContext` returns null for orgless users), e.g. a small
  `getAuthUser()` helper used by the root page.
- `(app)` layout keeps its no-org guard, now redirecting to `/setup`.
- Middleware `PUBLIC_PATHS` += `/signup`, `/privacy`, `/terms`.

## Workstream B — Walkthrough & activation

### Guided tour

`src/components/domain/onboarding/guided-tour.tsx` — custom, no new dependency.
- Portal overlay with a rounded cutout (`box-shadow: 0 0 0 9999px rgba(0,0,0,.45)`), target
  scrolled into view, tooltip card placed by direction (auto/start/end/top/bottom, RTL-aware).
- Step shape: `{ id, route?, target?, title, body, placement? }`; route steps navigate then
  wait (≤ 2s poll) for the target; missing target → skip step, never crash.
- Controls: progress dots + counter, Back, Next/Finish, Skip. Keyboard: Esc, ←/→, Enter.
  Focus moves to the tooltip card; `role="dialog"`, `aria-modal`, labels in ar/en.
  All motion respects `prefers-reduced-motion`.
- Steps (ar/en copy): dashboard ring → period/property filters → property cards → sidebar/tab
  bar → collections + record-payment → contract wizard entry → reports → notifications bell →
  settings/install → finish.
- State: runs automatically on `/dashboard?tour=1`; entry points (`More` → "دليل الاستخدام",
  account menu → "أعد الجولة", command palette action) navigate to `?tour=1`. Completion calls
  `markTourDone()` (sets `tour_done_at`); skip also marks it done (no nagging).
- Targets get `data-tour="…"` attributes.

### Activation checklist

- `src/server/queries/onboarding.ts` → `setupChecklist(ctx)` computes: office profile
  (name + logo), property, units, tenant, contract, payment, team member (members > 1),
  installed (client-only via `display-mode: standalone`).
- `SetupChecklist` widget (white card, progress ring, rows with check circles, deep links,
  dismiss ×) shown on the dashboard while incomplete and not dismissed; hidden when complete.
- Dismiss → `dismissChecklist()` persisting `checklist_dismissed_at`.
- Dashboard for an org with no properties renders a designed welcome hero + checklist instead
  of zeroed widgets (widgets stay for orgs with data).

## Workstream C — UI/UX polish & launch readiness

- Auth polish: password visibility toggles on login/signup/reset; inline field errors after
  blur; autofocus first field; Enter submits; specific, friendly error copy; welcome/login
  CTAs to signup (respecting `ALLOW_SIGNUP`).
- Empty states: audit every list/report page; every empty state gets an illustration, a
  one-line explanation and one primary action.
- Loading: `loading.tsx` skeletons matching final layout for collections, properties, tenants,
  contracts, expenses, reports (dashboard exists).
- Launch kit: `/privacy` + `/terms` bilingual pages (Kuwait-specific data-handling summary;
  support contact from `NEXT_PUBLIC_SUPPORT_EMAIL`, default `support@ejarikw.com`),
  `app/robots.ts`, `app/sitemap.ts` (public pages only), updated `README.md`, new
  `docs/LAUNCH.md` (production env, Supabase auth URLs + templates, cron, backups, monitoring,
  go-live verification).
- New strings in `messages/{ar,en}/setup.json` (+ `auth`, `onboarding`, `nav` additions),
  registered in the message loader (`src/i18n/request.ts`) and the i18n completeness test;
  `pnpm i18n:check` must stay green.

## Testing

- **Unit (Vitest):** signup/setup zod schemas, password rules, checklist computation
  (pure function on counts), tour step definitions (routes/targets/order), signup-enabled flag.
- **RLS:** unchanged; `completeSetup` guarded server-side.
- **E2E (Playwright):** new `signup.spec.ts`: sign up (confirmations off locally) → setup wizard
  (office + first property) → dashboard checklist visible → run the tour to completion →
  record a payment → checklist item completes → sign out → sign back in with the new password.
  Axe scan on signup, setup and the tour overlay.
- **Visual:** add signup, setup step 2, new-org dashboard, tour overlay to the existing matrix
  (ar/en × light/dark × 390/1440) = 32 new baselines; regenerate with
  `--update-snapshots=all`.

## Acceptance criteria

1. A brand-new person can create an account, confirm (when enabled), name their office, load a
   first property and reach the dashboard without help.
2. The tour explains the main screens and can be skipped, completed and re-run.
3. The checklist reflects real data and disappears when done or dismissed.
4. No dead ends: no-org users always land in `/setup`; sign-out → sign-in works with the new
   credentials; legal pages reachable from signup.
5. `pnpm typecheck && pnpm lint && pnpm test && pnpm build` green; full e2e green; i18n check
   green; ar/en and light/dark correct at 390/1440.

## Decisions recorded (docs/DECISIONS.md)

- Open self-serve signup (email confirmation in production; instant session locally).
- No fake demo data for real orgs; the wizard creates the office's real first property and the
  checklist guides the rest.
- Custom tour component instead of a dependency (bundle budget); once-only by default.
- Org logo optional; Arabic office name required.
