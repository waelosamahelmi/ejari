# Client follow-up — 14–17 November 2026

Reviewed six voice notes, six annotated images and the 44-second screen recording. Raw media/transcripts stay outside Git. The silent video's automatic subtitle hallucination was discarded; its visible rent revision/refresh sequence was inspected directly.

- [x] PACI in the unit clause for residential/commercial leases, including several units; supplement missing legacy presentation without changing saved rent/legal wording.
- [x] Studio option and user-entered custom unit types, persisted on the unit and offered as office-scoped suggestions. Preserve custom identity in documents and unit history/restructure results.
- [x] Payment periods follow the oldest unpaid month, for arrears and advances; enforce on the server as well as the month selector. Partial oldest-month payments remain possible.
- [x] Cancel a future lease before its start without constructing a reversed occupancy range; release its reserved occupancy, preserve payments/credit and save clearance.
- [x] Revised rent shown consistently for future leases, persists across reload/reopening, with deterministic same-date revisions and later revision boundaries preserved.
- [x] Independent electricity and water responsibility; legacy contracts retain their previous joint choice and saved legal snapshots.
- [x] Quality gates, database/browser tests, private encrypted backup, production migration, commit, push and deployment verification.

Additional fix: preserve form state when touch/pointer capabilities change; the review caught a wizard reset during a mobile full-page capture.
