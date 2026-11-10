# Merge/split follow-up — 11 November 2026

Reviewed the supplied 52-second video dated 10 November, 12:42:44. Speech recognition is imperfect; the visible sequence shows shops 11 and 12 selected, one result labelled 11+12, a second result left blank, and a disabled confirmation button. The client also asks about the result unit type/plot. No production units are merged automatically.

- [x] Separate merge and split modes: merging two or more sources creates one result; splitting one source starts with two results.
- [x] Prefill suggested labels, type, floor and asking rent from the selected sources, retaining editable result fields including plot type.
- [x] Show the missing requirements next to confirmation; make the mandatory reason visible before result rows. Keep source selection scrollable so the form remains usable on small screens.
- [x] Preserve existing server validation, atomic restructuring and unit/contract history.
- [x] Verify Arabic and English/mobile browser flows, complete the quality gate and push to GitHub.
