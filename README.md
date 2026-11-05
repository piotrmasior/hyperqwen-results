# HyperQwen / Field Notes

Independent community measurements of [HyperQwen](https://github.com/syv-ai/HyperQwen) on one RTX 4090 and an Intel Core i9-14900KF. A static, accessible results dashboard, structured evidence, and an append-only snapshot format for future releases.

**Initial study:** 149 measured requests, November 4–5, 2026 UTC, upstream revision [`6ab9bd0`](https://github.com/syv-ai/HyperQwen/tree/6ab9bd05cb84b538a6595d634f3e337ac8a80856). These are seven experiments on one revision, not seven release benchmarks. This repository contains results and presentation tooling; it does not configure or access an inference server.

## Preview

Requires Node.js 22.18 or later. No dependencies or install step.

```sh
npm test
npm run build
npm run preview
```

Open `http://127.0.0.1:4173`. `PORT=4174 npm run preview` selects another port. Stop the server with Ctrl-C. Opening the HTML directly from disk will not load the JSON data; use the preview server.

The dashboard has metric switching, exact-prefix comparisons, reasoning charts, an interactive conversation cache grid, completion/quality evidence, a paginated request ledger, per-request details, JSON/filtered CSV downloads, and snapshot comparison. Charts also have numeric tables or labels. No external fonts, analytics, third-party scripts, or runtime services are required.

## What the initial measurements show

- MTP/FP8 served up to 146,920 input tokens with thinking enabled and 146,884 with thinking off within a 150,000-token window. Output headroom matters.
- In the controlled allocation matrix, cold prefill was about 51.5 seconds at 100k, 66.2 at 120k, and 72.5 at 128k. Exact repeats brought this to approximately 0.71–0.73 seconds at 100k and 1.30–1.31 at 128k.
- Low reasoning reduced cold total response time by 17–45% versus xhigh on four 128k tasks, without a consistent quality advantage from xhigh.
- Changing conversations reused cache in 22 of 40 follow-ups. The other 18 had zero cached tokens despite shared prefixes.
- The original 16,282-token incomplete answer ended on a generated EOS, not a configured 16k cap. Sampling and disabling MTP did not reliably solve it. All four final conversation packages had correctness problems.

These findings are scoped to synthetic inputs and the measured configurations. Generated code was not executed. Read [methodology](docs/methodology.md), [the initial report](docs/initial-study.md), and [data definitions](docs/data-format.md) before interpreting differences.

## Update over time

See [adding results](docs/adding-results.md). Add a new immutable JSON snapshot and its checksum to the index using:

```sh
npm run add-snapshot -- /path/to/curated-snapshot.json
npm test
npm run build
```

Snapshots load automatically. The initial study's editorial sections remain tied to its ID; another snapshot shows its own measurements, environment and matched comparison without inheriting those conclusions. The comparison requires matching prompt fingerprints, serving profile, cache counts, request settings and method. Hardware/model/method differences withhold deltas; runtime differences are explicitly flagged.

## Publish later

The repository is prepared for a normal GitHub project Pages site. Nothing needs publishing to preview locally. When ready:

1. Create the intended GitHub repository and push this repository.
2. Under **Settings → Pages → Build and deployment**, select **GitHub Actions**.
3. Run **Publish results to GitHub Pages** manually, or publish a GitHub release from a tested commit. A source push only runs checks; it does not deploy.
4. The workflow builds `dist/`, uploads it, and deploys to Pages. Relative assets support a project URL such as `/<repository>/`.

The workflow follows [GitHub's custom Pages workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages). Publishing a release in **this results repository** publishes the site; a release in the upstream project does not automatically trigger new inference or publication.

## Evidence boundaries

Only allowlisted numerical measurements, configuration metadata, task briefs, review summaries, and SHA-256 evidence fingerprints are included. Raw prompts, transcripts, personal filesystem paths, host addresses, authentication material and client-integration instructions are absent. Original evidence is retained separately by the contributor. Source fingerprints identify retained records but do not make them publicly downloadable. This is a results-only publication, not a full independently runnable inference benchmark.

Not an official HyperQwen benchmark or endorsement. HyperQwen belongs to its upstream contributors; model repositories are linked in each snapshot. No model weights or upstream code are redistributed here.
