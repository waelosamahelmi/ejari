# Signup wizard, guided tour & launch polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline) to implement
> this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A brand-new office can self-register, complete a first-run wizard, learn the product
through a guided tour and an activation checklist, and the app ships with launch-readiness polish.

**Architecture:** Reuse the existing auth frame, `run()` server-action wrapper, `user_settings`
preferences, dashboard widget system and i18n namespaces. New pure logic lives in
`src/domain/account.ts` (unit-tested); UI is client components fed by server actions/pages.

**Tech Stack:** Next.js 15 RSC + Server Actions, React 19, TypeScript strict, zod, next-intl,
Tailwind v4 tokens, Vitest, Playwright. No new runtime dependencies (custom tour).

## Global Constraints (from CLAUDE.md / spec)

- Money in integer fils; times in Asia/Kuwait; logical CSS properties only (`ms/me/ps/pe/start/end`).
- Every string in `messages/{ar,en}`; `pnpm i18n:check` green.
- Server actions validate with zod and use `run()` + `ActionError`; never trust the client.
- New tables/columns: RLS on, `org_id`, `updated_at`; migrations numbered.
- Gate after every task: `pnpm typecheck && pnpm lint`; run focused tests; commit per task.
- Do not ask the human; record decisions in `docs/DECISIONS.md`.

---

## Phase A — Signup & first-run setup

### Task A1: Preferences schema — tour/checklist flags

**Files:**
- Create: `supabase/migrations/20261002000001_onboarding.sql`
- Modify: `src/lib/supabase/types.ts` (generated), `src/lib/auth.ts` (UserPrefs + mapping),
  `src/server/actions/preferences.ts`

**Interfaces produced:** `UserPrefs.tourDoneAt: string | null`, `UserPrefs.checklistDismissedAt:
string | null`; actions `markTourDone()`, `dismissChecklist()`.

- [ ] Migration:
```sql
alter table public.user_settings
  add column tour_done_at timestamptz,
  add column checklist_dismissed_at timestamptz;
```
- [ ] Add fields to `UserPrefs` + the `prefs` mapping in `getSessionContext`.
- [ ] Add actions (pattern from `savePreferences`):
```ts
export async function markTourDone() {
  return run(async () => {
    const ctx = await requireActionContext();
    const db = await supabaseServer();
    const { error } = await db.from("user_settings").upsert({ user_id: ctx.userId, org_id: ctx.orgId, tour_done_at: new Date().toISOString() });
    if (error) throw error;
  });
}
export async function dismissChecklist() { /* same, checklist_dismissed_at */ }
```
- [ ] Apply migration (`npx supabase db reset`), regenerate types (`pnpm db:types`).
- [ ] `pnpm typecheck && pnpm lint`; commit `feat: onboarding preference flags`.

### Task A2: Pure account logic (TDD)

**Files:** Create `src/domain/account.ts`, `tests/unit/account.test.ts`.

**Interfaces produced:**
```ts
export function passwordProblem(pwd: string): "short" | "weak" | null; // ≥8, letter+digit
export interface SetupCounts { orgNamed: boolean; hasLogo: boolean; properties: number; units: number;
  tenants: number; contracts: number; payments: number; members: number; }
export interface ChecklistItem { key: "profile"|"property"|"units"|"tenant"|"contract"|"payment"|"team"|"tour"; done: boolean; href: string; }
export function setupChecklist(c: SetupCounts): ChecklistItem[];
export function checklistComplete(items: ChecklistItem[]): boolean;
```
- [ ] Write failing tests: password cases (short, letters only, digits only, valid), checklist
  mapping order/hrefs, `done` rules (profile = orgNamed && hasLogo, team = members > 1, tour is
  a separate always-actionable row), `checklistComplete` ignores `tour`.
- [ ] Implement minimal pure functions. Hrefs: profile `/settings/org`, property
  `/properties?new=1`, units `/properties`, tenant `/tenants?new=1`, contract `/contracts/new`,
  payment `/collections`, team `/settings/users`, tour `?tour=1`.
- [ ] `pnpm test`; commit `feat(domain): account validation and activation checklist`.

### Task A3: `signUp`, `completeSetup`, `getAuthUser`

**Files:** Modify `src/server/actions/auth.ts`, `src/lib/auth.ts`.

**Interfaces produced:**
```ts
// src/lib/auth.ts
export const getAuthUser = cache(async (): Promise<{ id: string; email: string; name: string } | null>);
// src/server/actions/auth.ts
export async function signUp(input: { name: string; email: string; password: string; locale: "ar"|"en" }):
  ActionResult<{ next: "setup" | "verify" }>;
export async function completeSetup(input: CompleteSetupInput): ActionResult<{ orgId: string }>;
interface CompleteSetupInput { name: string; nameEn?: string;
  prefs: { locale: "ar"|"en"; digits: "latn"|"arab"; theme: "light"|"dark"|"system"; density: "comfortable"|"compact" };
  firstProperty?: { name: string; area?: string; block?: string; street?: string; count: number; askingRentFils: number }; }
```
- [ ] `signUp`: rate limit `signup:{email}` 5/10 min; zod name 2–80, password via
  `passwordProblem`, `terms` literal true; `supabase.auth.signUp({ email, password, options: {
  data: { full_name }, emailRedirectTo: `${PUBLIC_ENV.appUrl}/${locale}/auth/callback?next=/${locale}/setup` } })`;
  map "already registered" → `ActionError("email_taken")`; return `{ next: data.session ? "setup" : "verify" }`.
- [ ] `getAuthUser`: cached `supabase.auth.getUser()` returning id/email/user_metadata.full_name.
- [ ] `completeSetup`: require user; reject if `org_members` row exists (`ActionError("already_setup")`);
  `rpc("create_org")`; seed categories (reuse list); create `user_settings` upsert with prefs +
  `onboarding_done: true`; org settings defaults (`dueDay: 1`, `allocationStrategy: "fifo"`,
  `receiptDuplicatePolicy: "warn"`, `digits`, numbering); optional first property + units
  (4 per floor from floor 1, labels 1..n, `asking_rent_fils`); `revalidatePath("/[locale]", "layout")`.
- [ ] Remove `createOrganization`/`no-org` usage (Task A6).
- [ ] Add error keys `email_taken`, `already_setup` to `messages/{ar,en}/errors.json`.
- [ ] `pnpm typecheck`; commit `feat(auth): signup and complete-setup actions`.

### Task A4: Signup page

**Files:** Create `src/app/[locale]/(auth)/signup/page.tsx`, `signup-form.tsx`; modify
`src/messages/{ar,en}/auth.json`; modify `src/components/domain/auth-frame.tsx` only if a slot is needed.

- [ ] Server page: `AuthFrame` with a signup headline (reuse slide 1 copy); redirect to
  `/{locale}/login` when `NEXT_PUBLIC_ALLOW_SIGNUP === "false"`.
- [ ] Client form (pattern `login-form.tsx`): fields name/email/password/confirm + terms checkbox
  linking `/privacy` `/terms`; password visibility toggle (`Eye`/`EyeOff`, `aria-pressed`);
  inline field errors after blur; autofocus name; Enter submits.
- [ ] Submit → `signUp`; success: `next === "setup"` → `window.location.href = /{locale}/setup`,
  else render the "check your email" state with a resend link (reuses magic-link? just copy).
- [ ] Link "لديك حساب؟ سجّل الدخول".
- [ ] Messages: `auth.signup.*` ar/en; `pnpm i18n:check`; commit `feat(auth): signup page`.

### Task A5: Setup wizard

**Files:** Create `src/app/[locale]/(auth)/setup/page.tsx`,
`src/app/[locale]/(auth)/setup/setup-wizard.tsx`, `src/components/domain/onboarding/setup-steps.tsx`
(step forms), `src/messages/{ar,en}/setup.json`; modify `src/messages/index.ts` (NAMESPACES += "setup").

- [ ] Server page: `getAuthUser()`; no user → redirect login; has org (`getSessionContext`) →
  redirect dashboard; render wizard with `{ userName }`.
- [ ] Wizard shell: dusk backdrop + `AuthCard`-style container, progress dots, Back/Next,
  step titles; state object `{ name, nameEn, logoFile, prefs, firstProperty }`.
  1. Welcome — greeting + three bullet points.
  2. Office — AR name (required), EN name, logo `<input type=file accept=image/*>` with preview.
  3. Preferences — language/digits/theme/density segmented controls (apply instantly via
     `savePreferences` too so the wizard itself switches).
  4. First property — name, area, block, street, unit count (Stepper), asking rent (`MoneyInput`);
     "تخطي الآن".
  5. Done — summary + "ابدأ استخدام إيجاري".
- [ ] Finish: `completeSetup(...)`; if a logo file exists, `uploadOrgLogo(formData)` (existing
  action) after the org exists; then `router.push('/{locale}/dashboard?tour=1')`.
- [ ] Messages `setup.*` ar/en; `pnpm i18n:check`; commit `feat(setup): first-run wizard`.

### Task A6: Routing & CTAs

**Files:** Modify `src/middleware.ts`, `src/app/[locale]/page.tsx`,
`src/app/[locale]/(app)/layout.tsx`, `src/app/[locale]/(auth)/no-org/page.tsx`,
`src/app/[locale]/(auth)/login/login-form.tsx`, `src/app/[locale]/(auth)/welcome/page.tsx`,
`src/components/ui/onboarding-pager.tsx` only if needed.

- [ ] `PUBLIC_PATHS += "/signup", "/privacy", "/terms"`.
- [ ] Root page: `getAuthUser` → login if null; `getSessionContext` → `/setup` if null else
  dashboard/owner.
- [ ] `(app)/layout.tsx`: redirect orgless users to `/setup`.
- [ ] `no-org/page.tsx`: replace with a server redirect to `/setup`.
- [ ] Login: "ليس لديك حساب؟ أنشئ مكتبك" link (hidden when signup disabled). Welcome pager:
  secondary CTA "إنشاء حساب" when not onboarded (respects the flag).
- [ ] Commit `feat(auth): route orgless users into the setup wizard`.

### Task A7: Signup e2e + a11y

**Files:** Create `tests/e2e/signup.spec.ts`; modify `tests/e2e/a11y.spec.ts` (add `/ar/signup`,
`/en/signup`, `/ar/privacy`, `/ar/terms`).

- [ ] e2e (skips without Supabase): unique email `owner+<ts>@demo.test`; submit signup; expect
  `/setup`; step through office (unique name) + preferences + first property (2 units); expect
  dashboard and checklist visible with "property" row done; `?tour=1` not required here; open
  More → "دليل الاستخدام" via account menu later (Phase B covers the tour).
  Then sign out, sign back in with the new password, expect dashboard.
- [ ] Axe scan signup page + setup step 2 + the tour overlay (Phase B) with zero violations.
- [ ] Run `pnpm test:e2e tests/e2e/signup.spec.ts`; commit `test(e2e): signup and first-run wizard`.

---

## Phase B — Walkthrough & activation

### Task B1: Checklist query (TDD)

**Files:** Create `src/server/queries/onboarding.ts`, `tests/unit/onboarding-query.test.ts`
(pure mapper only), modify `dashboard` page.

**Interfaces produced:** `getSetupChecklist(ctx): Promise<{ items: ChecklistItem[]; counts: SetupCounts; dismissed: boolean }>`.
- [ ] Pure mapper test: count → `ChecklistItem[]` via `setupChecklist` (already tested in A2);
  query task verifies Supabase counts mapping by stubbing rows through the pure mapper.
- [ ] Query: `Promise.all` counts (`properties`, `units`, `tenants`, `contracts` status active,
  `payments` not voided, `org_members` active) using `{ count: "exact", head: true }`;
  `dismissed = !!ctx.prefs.checklistDismissedAt`.
- [ ] Commit `feat(onboarding): setup checklist query`.

### Task B2: Checklist widget + new-org dashboard

**Files:** Create `src/components/domain/onboarding/setup-checklist.tsx`; modify
`dashboard/page.tsx`, `dashboard-view.tsx`, `src/server/actions/preferences.ts` (action already
in A1), messages `dashboard.json` (+ `setup.json` reuse).

- [ ] Client widget: card with progress ring (`ProgressRing`), rows with green check circles /
  arrow links, dismiss × → `dismissChecklist()` + optimistic hide; install row uses
  `matchMedia("(display-mode: standalone)")` and hides when installed; "tour" row button starts
  the tour (`?tour=1`).
- [ ] Dashboard: render `<SetupChecklist>` above the bento while `!dismissed && !complete`.
  When `properties === 0`, render a hero card ("لنبدأ بإضافة أول عقار" + CTAs to property/checklist)
  above it; keep widgets below.
- [ ] Commit `feat(dashboard): activation checklist and new-office hero`.

### Task B3: Guided tour

**Files:** Create `src/components/domain/onboarding/guided-tour.tsx`,
`src/components/domain/onboarding/tour-steps.ts`, `tests/unit/tour-steps.test.ts`; modify
`dashboard/page.tsx`, `dashboard-view.tsx`, `app-shell.tsx` (bell target), `more/page.tsx`,
`account-menu*.tsx`, command palette actions; add `data-tour` attributes:
`dashboard-ring`, `dashboard-filters`, `dashboard-properties`, `nav`, `collections`,
`collections-rows`, `contracts-new`, `reports`, `notifications`, `settings-install`.

**Interfaces produced:**
```ts
export type TourPlacement = "auto" | "top" | "bottom" | "start" | "end";
export interface TourStep { id: string; route?: string; target?: string; titleKey: string; bodyKey: string; placement?: TourPlacement; }
export const TOUR_STEPS: TourStep[];
```
- [ ] Unit-test `TOUR_STEPS`: unique ids, every target selector starts with `[data-tour=`,
  allowed routes, order (dashboard → collections → contracts → reports → settings).
- [ ] `GuidedTour`: portal overlay; hole via `box-shadow` cutout around the target rect;
  scroll target into view; tooltip card positioned by placement with viewport clamping and RTL
  flip; step counter + dots; Back/Next/Skip; Esc skips; ArrowLeft/Right navigate; focus moves
  into the card; `role="dialog" aria-modal`; reduced-motion; missing target → skip step. Route
  steps: `router.push(step.route)`, then poll up to 2s for the target.
- [ ] Dashboard page: pass `startTour = searchParams.tour === "1"`; DashboardView renders the
  tour when `startTour || requested`; finishing/skipping calls `markTourDone()`.
- [ ] Entry points: More list row "دليل الاستخدام" → `/{locale}/dashboard?tour=1`; account menu
  item; command palette action "ابدأ الجولة".
- [ ] Messages `tour.*` ar/en; `pnpm i18n:check`; commit `feat(onboarding): guided product tour`.

### Task B4: Tour/checklist e2e + visuals

**Files:** Modify `tests/e2e/signup.spec.ts` (extend), `tests/e2e/visual.spec.ts`,
`tests/e2e/a11y.spec.ts`.

- [ ] e2e: after setup, run the tour from the checklist row; assert first tooltip and that
  Next advances; finish; assert `tour_done_at` set via service role; reload → tour does not
  auto-start; relaunch from More works.
- [ ] Visual: add screens `signup`, `setup`, `dashboard-new`, `tour` for the full matrix by
  creating two extra users in `beforeAll` (service role): `visual-setup@demo.test` (no org) and
  `visual-new@demo.test` (empty org). Regenerate baselines with `--update-snapshots=all`.
- [ ] Commit `test(e2e): tour and checklist coverage`.

---

## Phase C — UI/UX polish & launch readiness

### Task C1: Auth & form polish
- [ ] Shared `PasswordInput` component with visibility toggle + hint; use in signup/login/reset.
- [ ] Inline blur validation and Enter submit verified on login/signup/setup.
- [ ] Commit `feat(ui): password input and auth polish`.

### Task C2: Empty states & loading skeletons
- [ ] Audit list/report pages; add `EmptyState` with one CTA where missing (properties, units,
  tenants, contracts, expenses, deposits, legal, reports, payments, owners).
- [ ] Add `loading.tsx` skeletons for collections/properties/tenants/contracts/expenses/reports.
- [ ] Commit `feat(ui): empty states and loading skeletons`.

### Task C3: Legal pages, robots, sitemap
- [ ] `/{locale}/privacy`, `/{locale}/terms` (public prose pages, messages `policy.*`,
  `NEXT_PUBLIC_SUPPORT_EMAIL` fallback `support@ejarikw.com`); links from signup + Settings → Org.
- [ ] `src/app/robots.ts`, `src/app/sitemap.ts` covering public pages only.
- [ ] Commit `feat(web): legal pages, robots and sitemap`.

### Task C4: Launch docs & final verification
- [ ] `docs/LAUNCH.md` checklist (env, Supabase project/auth URLs/templates, cron, backups,
  monitoring, demo-accounts off, signup policy, DNS); README updates
  (`NEXT_PUBLIC_ALLOW_SIGNUP`, `NEXT_PUBLIC_SUPPORT_EMAIL`, signup flow); DECISIONS + PROGRESS.
- [ ] Full gate: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`; `pnpm test:e2e`;
  `pnpm test:rls`; regenerate visuals if needed.
- [ ] Commit `docs: launch checklist and final verification` + `phase 13: launch readiness`.

## Self-review notes

- Spec coverage: every spec section maps to A1–A7 (signup/setup/routing), B1–B4 (checklist/tour),
  C1–C4 (polish/launch).
- No placeholders: the only deferred detail is exact AR/EN copy, written during each UI task.
- Types: `ChecklistItem`, `SetupCounts`, `TourStep`, `CompleteSetupInput`, `UserPrefs` fields are
  defined once and reused verbatim.
