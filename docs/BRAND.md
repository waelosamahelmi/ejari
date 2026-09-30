# إيجاري | Ejari — Brand guide

Domain: **ejarikw.com**. Arabic name **إيجاري** ("my rent / my lease"), English **Ejari** (*eh-JAA-ree*).
Idea: *"كل باب… في مكانه."* / *"Every door, accounted for."* Personality: trustworthy, calm, precise, quietly premium, hospitable.

> Trademark: Dubai's tenancy registration system is also "Ejari". Never use Dubai/RERA colors or styling; run a Kuwait trademark check before launch.

## Symbol
An arched Gulf doorway built only from circles and straight lines. The door opening is the letter **ا** (alif, first letter of إيجاري) as a tall slot; the **hamza** of إ sits beneath the threshold as a small dot. A door, and the start of the name.

Masters (built by `pnpm brand:build`, hand-optimized SVG, outlined glyphs — no live fonts):

| File | Use |
|---|---|
| `public/brand/mark.svg`, `mark-mono.svg`, `mark-white.svg` | Symbol (ink / currentColor / white) |
| `lockup-ar.svg` | Mark on the **right** + إيجاري |
| `lockup-en.svg` | Mark on the **left** + Ejari |
| `lockup-bilingual.svg` | Stacked: mark, إيجاري, Ejari (splash, login, letterhead) |
| `wordmark-ar.svg` | IBM Plex Sans Arabic Bold outlines; alif of إ +12 % taller (echoes the door slot); final ي tail shortened and flattened |
| `wordmark-en.svg` | Inter SemiBold outlines, tracking −2 %; the dot of the **i** is a tiny arch |
| `app-icon*.svg` | White mark ≈ 58 % width on an Ink squircle, warm light gradient inside the door slot; maskable keeps the mark in the 80 % safe zone |
| `arch-pattern.svg` | Mashrabiya-feel tile, ≤ 4 % opacity, print cover sheets and auth backdrop only |

`pnpm brand:assets` regenerates favicons (`favicon.ico` 16/32/48, dark-aware `icon.svg`), `apple-icon.png` 180, PWA icons (192/512 any + maskable, monochrome 96), shortcut icons, iOS splash screens (20 devices × light/dark) and photo variants (AVIF/WebP at 640/1280/2048 + blur placeholders).

**Clear space** = the arch's inner opening height (30/64 of the mark). **Minimum size**: mark 16 px, lockups 96 px wide.
**Don't**: stretch, outline, add shadows, recolor outside the palette, place on unscrimmed photos, rebuild with live fonts.

## Palette
| Token | Light | Dark | Use |
|---|---|---|---|
| `--brand-ink` | #0E0F12 | #F5F5F7 | Primary pills, active chips/tab, toggles on |
| `--brand-paper` | #FFFFFF | #1C1C1E | Cards, sheets |
| `--brand-mist` | #ECEEF2 | #0B0B0D | App background |
| `--brand-dusk` | #C9D4E3→#D8CCD6 | #1A1F2B→#241C24 | Onboarding/login/splash backdrop |
| `--brand-sand` | #C9A66B | #D9B77C | Premium highlight, ≤ 5 % of a screen, illustration accent |
| `--brand-gulf` | #2F5BFF | #5B7FFF | Links, focus rings, chart series 1 — never big fills |
| `--brand-rose` | #F0508C | #FF6FA3 | One emphasis per screen at most |

Status colors stay Apple semantic (green paid, orange partial, red late/legal, indigo advance, teal free/grace, gray vacant). Chart series order: gulf, ink 60 %, sand, teal, gray. Live contrast ratios: `/[locale]/dev/brand`.

## Typography
Arabic **IBM Plex Sans Arabic**, English **Inter**; all numerals Inter with tabular figures (`.num`). Headlines are large and tight (1.1) with weight contrast inside one line: "إدارة **عقاراتك** بهدوء" / "Your buildings, **calmly managed**". Mixed-script runs are isolated with `<bdi>` / `unicode-bidi: isolate`.

## Photography
Modern Gulf residential architecture, golden hour or dusk, calm skies, no people, no brands. Photos lead on places (onboarding, login, property, unit, owner home) and never on ledgers. Text on a photo always sits on the scrim. Properties without a photo get the generated architectural cover (`CoverFallback`), never a gray box. Sources: `docs/CREDITS.md`.

## Illustrations
Ten line illustrations (`src/components/illustrations`): 1.75 px rounded strokes in ink, one sand accent, the arch motif recurring — no properties, units, tenants, contracts, payments, expenses, notifications, offline, and the celebratory "no late units" / "no vacant units" (+ "no results").

## Motion
Springs (`src/lib/motion.ts`): `spring` 400/32, `gentle` 260/30. Launch animation ≤ 700 ms (arch draws, fills, wordmark rises). The 100 %-collected celebration is a single sand shimmer around the ring. Everything is disabled under `prefers-reduced-motion`.

## Voice & microcopy glossary
Arabic: Modern Standard Arabic, warm and short, Gulf-friendly vocabulary, imperative buttons. English: plain, calm, confident. Numbers first. Neither is a literal translation of the other.

| Concept | العربية | English |
|---|---|---|
| Record payment | سجّل دفعة | Record payment |
| Print statement | اطبع الكشف | Print statement |
| Arrears | متأخرات | Overdue / arrears |
| Collected | المحصل | Collected |
| Vacant | خالية | Vacant |
| Payment voucher | سند صرف | Voucher |
| Deposits | إيداعات | Deposits |
| Grace period | فترة سماح | Grace period |
| Late summary | ٧٠٫٠٠٠ د.ك متأخرات على وحدتين | 70.000 KWD overdue across 2 units |
| Empty (good news) | لا توجد وحدات متأخرة هذا الشهر. عمل رائع. | No late units this month. Nicely done. |
| Offline | أنت غير متصل — سيتم مزامنة ٣ دفعات | Offline — 3 payments will sync |
| Update | تحديث جديد متاح — إعادة التحميل | Update available — Reload |

Errors say what happened and what to do next; never raw codes.
