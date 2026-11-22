# Client review — 19 November 2026 (implemented 22 November)

Sources: the written request, seven images (including duplicate print previews) and the 12:35:50 voice note. Raw media and the readable transcript are retained outside Git.

- [x] Prepare numbered rent receipts without creating payments or reporting income. Preserve owner/tenant/property/unit/period/amount snapshots; collect later under the same number.
- [x] Print all or selected prepared receipts and paid receipts in batches of up to 100. Two normal-length receipts fit on one A4 sheet; long content can continue without being clipped.
- [x] Automatic owner-specific annual numbering across properties, with separate receipt/voucher sequences. Preserve historical identifiers. An explicit numbering owner is required for expenses spanning different owners.
- [x] Printed-uncollected receipt report and print-request history/counts, including paid receipts and expense vouchers. Reprints of a prepared receipt and its linked payment share one document identity.
- [x] Exact-date or monthly collection and expense ledgers; contract report by property with contractual dates and rent. Screen, print and Excel use the same report data.
- [x] Vacant collection rows cannot be selected or opened for payment.
- [x] Expense notes retain their line breaks in the printed voucher.
- [x] Correct A4 statement sizing and table pagination. Headers can repeat across genuine page breaks; the grand total appears once at the end.
- [x] Remove the automatically appended discount clause from new and legacy contract presentation. Preserve the original rent, accounting adjustments and frozen stored legal data.
- [x] Quality gates, browser/PDF verification, encrypted backup and both production migrations verified; publish the checked release to GitHub.

Print counts represent requests to open the print dialog (including PDF saves/cancellations), not proof that a printer produced a particular number of paper copies. Tracking starts with this release; earlier print events cannot be reconstructed.

Validation: 301 unit tests, 25 database/RLS cases, all 40 distinct nonvisual browser cases (updated legacy receipt/discount assertions rerun), and four visual cases / 64 captures. Actual PDF checks cover the 29-unit A4 statement, prepared and paid two-receipt A4 batches, and voucher notes. The six receipt database cases were rerun after tightening explicit hosted API grants, including immutable documents/logs and rejection of null/blank cancellation reasons.
