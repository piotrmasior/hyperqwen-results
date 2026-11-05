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

At this initial preparation stage, the GitHub Pages workflow had not been dispatched and no public repository or hosted site had been created. Publication is recorded separately by the repository's [GitHub Pages workflow runs](https://github.com/piotrmasior/hyperqwen-results/actions/workflows/pages.yml).

## Remote installation guide addition

Checked 2026-11-05 with the same Node/browser toolchain and Python 3.14.2. This addition changes the guide and build tooling; the historical snapshot bytes and 149 measurements are unchanged.

- `npm test`: eight Node tests and three Python tests passed. The new tests cover exact command-text preservation, guide anchors/escaping, archive file allowlisting and neutral ownership, adapter revision/source/overwrite refusal, two serial identical requests, timing/cache separation, missing metrics, capped output, token-count mismatch and preservation of failed evidence. API tests use a temporary loopback simulation, not a GPU server.
- `npm run build`: passed. The guide renders from its Markdown source, and the kit contains only seven explicitly selected documentation/helper/profile files. Archive contents matched the source bytes; the browser-downloaded archive matched the built archive.
- Checked the adapter against a fresh checkout of the actual pinned upstream revision. Generated native scripts passed Bash/Python syntax checks. All 18 runbook command blocks passed `bash -n`; none of those installation commands were executed.
- Browser: inspected 1440 × 1100 desktop and 390 × 844 mobile, including command panels. Checked clipboard copying, section navigation, dashboard-to-install navigation and all six distinct local guide links. No document-width overflow in the checked views; long commands scroll within their panels. No console errors or warnings in the checked guide session.
- Loaded the guide under `/project/` to check GitHub project Pages paths, then downloaded the kit through its actual link. Reduced-motion section navigation kept the target heading below the sticky header.
- Inspected the kit for contributor-specific accounts, personal paths and LAN addresses; these are absent. The runbook uses placeholders, target-machine discovery and generic loopback URLs, with no contributor machine description. The separately included methodology identifies the hardware used in the historical study.

This is source inspection, offline helper validation and site testing. It is not a fresh GPU installation, package-resolution test, model-download test, full historical benchmark replay or live deployment. No inference service was changed. Optional installation commands and the smoke probe run only when a reader explicitly invokes them on their own target.
