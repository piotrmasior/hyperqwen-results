# Results repository guidance

- This repository contains curated results and presentation code. Do not copy deployment credentials, host addresses, raw private transcripts, personal filesystem paths or client-integration instructions here.
- General installation documentation and portable reproduction helpers belong in `docs/install-remote.md` and `reproduce/`. Use placeholders and loopback URLs; do not install on a real server as part of site validation. The synthetic smoke probe is not the historical benchmark harness.
- Preserve published snapshots. Add new measurement IDs and checksums; never overwrite earlier measurements to reflect a new release.
- Keep API termination, output-cap exhaustion, semantic completion and correctness distinct. Do not infer a quality pass from `stop`.
- Separate loaded-model cold-input prefill, cache reuse, decode speed and client latency. Keep setup failures and limitations in the report.
- Never fabricate a second release, timing distribution or statistical significance. Test-only synthetic copies must remain confined to tests.
- New editorial conclusions must identify the snapshot they describe. Existing initial-study findings must not appear under a later snapshot as fresh results.
- Run `npm test` and `npm run build` after data or behavior changes. Check responsive charts and exports in a browser when changing the interface.
- Publication is a separate action. Source pushes run checks; manual workflow dispatch or a published release deploys the site.
