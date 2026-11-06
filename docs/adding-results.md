# Add a measured release

The November 6 quality investigation uses its own append-only index at `public/data/investigations/index.json`, with SHA-256 checksums and separate validation. Its curated records include grouped and per-request costs, reviewed-package hashes, first held-out results, fresh-run outcomes, precision probes and full-context timings. It is not inserted into the release-comparison selector because its adaptive and numerical-control protocols are different from the initial performance study. Add future investigations with new IDs, preserve the original data, and identify any narrative's study explicitly.

1. Record the full upstream commit and release tag if present; record hardware, model/quantization refs, installed runtime versions and effective serving profiles. Keep the original measurements immutable.
2. Use the same frozen fixtures and method for a matched comparison. Record exact rendered input-token hashes when possible. Retain cold/exact-repeat/follow-up labels and actual cached tokens. Include failed/capped outcomes, not only successful answers.
3. Prepare a curated snapshot matching `docs/data-format.md`. Use a new ID such as `YYYY-MM-DD-<short-commit>`. Export only measured numerical fields, public configuration metadata and reviewed findings. Use null for unavailable measurements. Remove raw transcripts, machine addresses, account paths, secrets and unrelated integration details before import.
4. Review the new snapshot locally, then run:

```sh
npm run add-snapshot -- /path/to/curated-snapshot.json
npm test
npm run build
npm run preview
```

5. Inspect the new selection, request ledger, downloadable JSON/CSV, hardware metadata and comparison. The first study's narrative is shown only for its own snapshot. Add any new editorial narrative explicitly with its own snapshot guard; do not recycle old findings.
6. Commit the new snapshot, index and any reviewed narrative changes. Published snapshots are append-only. If a correction is necessary, use a new ID, explain it in its label/report, and retain the original. Do not rewrite results in place to fit newer conclusions.
7. When publication is intended, publish a release in this results repository or manually run the Pages workflow. Pushes alone validate the project without publishing. New upstream releases do not trigger inference automatically.

`add-snapshot` validates the record and refuses duplicate IDs. `npm test` checks integrity, counts, arithmetic, context budgets, data boundaries, comparison matching, guide rendering and reproduction helpers. The content scan is a defense against common accidental leaks, not a substitute for reading the publication diff. The project contains no server credentials. Its optional synthetic API probe runs only when explicitly invoked against a prepared server.

The [installation runbook](install-remote.md) gives new contributors a generic starting point. For exact historical inference reproduction, separately publish reviewed frozen fixtures and a portable benchmark harness in a future change. Current source hashes identify contributor-retained evidence; they do not claim the complete experiment can be rerun from the installation kit.
