# Launch checklist — Ejari (ejarikw.com)

Everything in the repo is ready for a Vercel + Supabase deployment. This is the go-live runbook.

## 1. Infrastructure

- [ ] Supabase project created (region close to Kuwait, e.g. `me-central-1` / `eu-central-1`).
- [ ] `npx supabase link --project-ref <ref>` then `npx supabase db push` (all migrations applied).
- [ ] Storage buckets exist and are private: `contracts`, `receipts`, `vouchers`, `documents`, `branding`.
- [ ] Optional staging seed: `pnpm seed` (never run the demo seed on production).
- [ ] Backups: confirm daily backups on the Supabase plan (PITR recommended).

## 2. Vercel

- [ ] Repo imported; framework auto-detected (Next.js 15, pnpm).
- [ ] Env vars from `.env.example` set for Production:
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
  `NEXT_PUBLIC_APP_URL=https://ejarikw.com`, `CRON_SECRET` (random 32+ chars),
  `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` (`pnpm vapid`),
  `NEXT_PUBLIC_ALLOW_SIGNUP=true`, `NEXT_PUBLIC_DEMO_ACCOUNTS=0`,
  `NEXT_PUBLIC_SUPPORT_EMAIL`, optional `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN`.
- [ ] Deploy; confirm `vercel.json` registered both crons (`/api/cron/charges` nightly UTC 21:00,
      `/api/cron/notifications`) and that `CRON_SECRET` is sent.
      **Cron plan limits:** Vercel Hobby rejects sub-daily expressions at deploy time, so the repo
      ships a daily notifications run (`0 6 * * *` = 09:00 Kuwait). On Pro, change it to hourly
      (`0 * * * *`) before launch.
- [ ] Domain `ejarikw.com` connected (A/CNAME per Vercel), HTTPS ready.

## 3. Supabase Auth

- [ ] URL configuration: Site URL `https://ejarikw.com`, redirect URLs
      `https://ejarikw.com/**` (and `http://localhost:3000/**` for dev).
- [ ] Email templates: upload the branded bilingual files from `supabase/templates/`
      (`confirmation`, `magic_link`, `recovery`, `invite`, `email_change`).
- [ ] Confirmations ON for production signup (auth.email.enable_confirmations) so new offices
      verify their email; keep rate limits on.
- [ ] SMTP: use a transactional provider (Resend/SES) instead of the built-in mailer for volume.
- [ ] Optional: enable CAPTCHA (hCaptcha/Turnstile) and set the Supabase captcha secret.

## 4. Product configuration

- [ ] Signup policy: leave `NEXT_PUBLIC_ALLOW_SIGNUP=true` for self-serve, or `false` for
      invite-only (the login/welcome CTAs hide automatically).
- [ ] After the first real signup, review Settings → Org, Numbering, Billing rules, Templates,
      Reminder message, Expense categories and Beneficiaries with the office.
- [ ] Push: open Settings → Notifications, send a test notification from each device type.
- [ ] Install the PWA on one Android and one iPhone; verify standalone launch, offline
      collections and the app badge.

## 5. Pre-flight verification (local, against the production build)

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
pnpm test:e2e          # 21 specs incl. signup wizard, tour, a11y, visual, offline, push
pnpm test:rls          # cross-org isolation + role limits
pnpm i18n:check
```

- [ ] All green; no console errors in the e2e suite.
- [ ] Lighthouse (mobile, authenticated): Accessibility/Best Practices 100; performance depends
      on the deployed CDN for the first property photo.
- [ ] Check `docs/DESIGN_REVIEW.md` known limitations are acceptable for launch.

## 6. Legal & support

- [ ] Review `/ar/privacy` and `/ar/terms` (and EN) with legal counsel; adjust `policy.json`.
- [ ] Set `NEXT_PUBLIC_SUPPORT_EMAIL` to a monitored inbox.
- [ ] Kuwait trademark check for "إيجاري / Ejari" (noted in `docs/DECISIONS.md`).

## 7. Day-one monitoring

- [ ] Sentry receiving client/server errors (if DSN set).
- [ ] Supabase logs clean; cron routes returning 200 each hour.
- [ ] First office onboarded end-to-end: signup → setup → tour → first property → first payment.

## Rollback

- Vercel: promote the previous deployment.
- Database: migrations are additive; restore from the latest Supabase backup if needed.
