# Local validation record

Checked 2026-11-05 with Node.js 22.20.0 and Chromium through Playwright CLI 0.1.23. This records local checks, not an executed GitHub Actions deployment.

- `npm test`: five tests passed, covering initial experiment counts, EOS/cache observations, budget/arithmetic validation, leak/unknown-field rejection, matching rules and CSV escaping.
- `npm run build`: static build passed; 149 measurements in one snapshot, 25 source artifact fingerprints, snapshot checksum verified.
- Browser: metric switching, 100k/128k cache selection, 20k/30k conversation selection, turn detail, combined ledger filters, pagination and request dialog verified.
- CSV: downloaded the four mitigation rows and independently parsed them; generated-token counts matched 25,250 / 14,665 / 13,319 / 17,610.
- Responsive inspection: 1440 × 1100 desktop and 390 × 844 mobile. Document width stayed within the mobile viewport. Wide numeric charts/tables scroll within their own containers.
- Project-path hosting: loaded under `/project/`; modules, data and document links resolved. No browser console errors or warnings in the checked run.
- Future snapshots: used an explicitly test-only synthetic copy in an isolated temporary project. Import, full validation, duplicate refusal, build, browser selection, comparison and initial-narrative isolation passed. No synthetic measurement snapshot is included in the delivered data.

One initial browser automation selector (`getByLabel` with an exact match) timed out before exercising the ledger. Repeating with the rendered combobox role/name completed the remaining checks. No inference benchmarks were rerun for this presentation project.

The GitHub Pages workflow is prepared and based on official Actions documentation, but has not been dispatched. No public repository or hosted site was created during this preparation.
