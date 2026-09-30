# Decisions log

| Date | Decision | Reason |
|---|---|---|
| 2026-09-30 | Pinned Next.js 15.5 and TypeScript 5.9 (not TS 7). | TypeScript 7 (native) has no JS compiler API; Next 15 loads `next.config.ts` through it and crashes. |
| 2026-09-30 | Local Supabase runs on ports 5532x (API 55321, DB 55322, Studio 55323, Inbucket 55324). | Another local Supabase project on this machine already uses the default 5432x ports. |
| 2026-09-30 | Root `app/layout.tsx` is a pass-through; `[locale]/layout.tsx` and `print/layout.tsx` render their own `<html>`. | Print routes must have no app chrome and choose their own document language/direction. |
| 2026-09-30 | Brand name spelled **Ijari** in English (never "Ejari"). The client should run a Kuwait trademark check before launch. | Dubai's tenancy system is also called إيجاري ("Ejari"). |
