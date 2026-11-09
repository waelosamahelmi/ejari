# Client edits — 9 November 2026

Source: the supplied WhatsApp export (26 October–9 November) and earlier attachments (20–25 October). Reviewed all 6 archive images, 15 archive voice notes and 5 video files, plus the five earlier October voice attachments and three reference images. Chat references additional omitted/duplicate media; only supplied files are evidence. Raw transcripts stay outside Git because they contain personal and commercial information.

## Acceptance checklist

- [x] Company tenant: licence number, authorised signatory name and Civil ID; include them in the printed lease.
- [x] Receipt: property name and complete address at the top, centred receipt title, readable receipt/date metadata, unit type and labels. No overlapping text.
- [x] Property statement: property name and complete address in the header.
- [x] Entry-only staff: record rent and expenses, without editing/deleting existing receipts, leases or expenses.
- [x] Assign each staff member one or more properties; hide all other property data, enforced in the database as well as the UI.
- [x] Remove a former member's access permanently without deleting accounting history or affecting unrelated organisations.
- [x] Document independent operation/ownership handover of hosting, database and source code.
- [x] Default unprefixed entry points to Arabic; preserve explicit English navigation.
- [x] Contract tenant selection: all eligible tenants, including existing tenants renting additional units; Arabic alphabetical ordering and search.
- [x] Require owner selection before advancing; filter property choices by that owner.
- [x] Remove mistaken tenant duplicates; archive tenants with history and prevent archival with a live lease.
- [x] Notice period starts at zero and requires explicit confirmation; utilities party requires explicit selection.
- [x] Temporary monthly discount at contract creation and later, with date range and reason; show gross rent, discount and collection separately.
- [x] Merge/split vacant units atomically, retaining historical units and contracts.
- [x] Multiple named tenants on one lease, including print/signatures and tenant histories; one accounting ledger per lease.
- [x] Reuse a PACI address number across multiple units.
- [x] Mandatory nationality selection on tenant create/edit.
- [x] Typecheck, lint, unit, database/RLS, browser and production-build verification; commit and push.

## Source mapping

- 26 October voice + images: company licence and authorised signatory.
- 7 November 12:42 voices + images: receipt/statement headers and full property/unit identification.
- 7 November 17:38 voices; 9 November 11:13 voice/image: entry-only permissions and property assignments.
- 7 November 19:42–20:20: commercial discussion and independent administration/ownership. No price is encoded in the product.
- 7 November 21:19: Arabic entry page.
- 9 November 09:55 text: merge/split, multiple tenants, shared PACI, staff/property permissions.
- Videos 10:25, 10:29, 10:32, 10:35, 10:37: tenant search/order, owner filtering/requirement, tenant removal, explicit notice/utilities selections.
- 9 November 10:41 voice: temporary discounts and statement columns.
- 9 November 11:16 voice: remove former staff access.
- 9 November 11:37 image/text: nationality required.

- Earlier 20–25 October attachments: paid-contract termination, missing printed owner details, removing contract branding/barcode, red printed variable values, and a progress follow-up. These existing October fixes are retained and covered by the contract browser regression.
