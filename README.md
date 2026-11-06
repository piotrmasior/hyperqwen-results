# HyperQwen / Field Notes

Independent community measurements of [HyperQwen](https://github.com/syv-ai/HyperQwen) on one RTX 4090 and an Intel Core i9-14900KF. A static, accessible results dashboard, structured evidence, and an append-only snapshot format for future releases.

[Results dashboard](https://piotrmasior.github.io/hyperqwen-results/) · [Remote installation guide](https://piotrmasior.github.io/hyperqwen-results/install.html) · [Validation runs](https://github.com/piotrmasior/hyperqwen-results/actions/workflows/check.yml)

**Quality follow-up, November 5–6:** [Interactive investigation](https://piotrmasior.github.io/hyperqwen-results/investigation.html) · [Full report](docs/quality-investigation.md). Four extensively supervised, adaptively repaired packages passed reviewed requirements and checks. A fresh bounded automatic workflow and the BF16-attention full-context trial each produced **0/4 complete, correct packages**. No reliable unattended configuration fix was established. The first held-out score remains **11/12**; subsequent repairs are regression evidence. The separate checksummed investigation dataset retains 246 measured generations, including rejected outputs: 3,021,468 output tokens and 8.10 hours of summed request wall time, excluding supervision and other costs. This used the same upstream revision, not a new release.

**Initial study:** 149 measured requests, November 4–5, 2026 UTC, upstream revision [`6ab9bd0`](https://github.com/syv-ai/HyperQwen/tree/6ab9bd05cb84b538a6595d634f3e337ac8a80856). These are seven experiments on one revision, not seven release benchmarks. This repository contains results, presentation tooling, and an optional generic installation kit. Building or viewing the site does not access an inference server.

## Preview

Requires Node.js 22.18 or later and `tar` to build; Python 3 is also required for the reproduction-helper tests. No third-party site dependencies or install step.

```sh
npm test
npm run build
npm run preview
```

Open `http://127.0.0.1:4173`. `PORT=4174 npm run preview` selects another port. Stop the server with Ctrl-C. Opening the HTML directly from disk will not load the JSON data; use the preview server.

The dashboard has metric switching, exact-prefix comparisons, reasoning charts, an interactive conversation cache grid, completion/quality evidence, a paginated request ledger, per-request details, JSON/filtered CSV downloads, and snapshot comparison. Charts also have numeric tables or labels. No external fonts, analytics, third-party scripts, or runtime services are required.

## Reproduce the serving setup

Open `/install.html` in the preview for the step-by-step remote installation guide, copyable commands, checkpoints and a downloadable kit. The same source is available as an [agent-readable runbook](docs/install-remote.md). It covers generic SSH access, compatibility checks, a pinned native environment, explicit model revisions, persistent serving, 64k/150k profiles, API validation, timing and rollback. It contains no contributor-specific machine configuration or client integration.

The kit includes `reproduce/prepare-native.py` (generates pinned native adapters), two environment profiles, and `reproduce/probe.py` (two synthetic streaming requests). The adapter supports only the documented upstream commit and refuses changed inputs. The probe records output and failures; it never grades correctness from API `stop`. Offline tests do not establish a successful fresh installation on a GPU. The kit is **not** the historical 149-request harness: exact replay still requires the original frozen fixtures and trajectories.

The build renders the guide from Markdown, copies only allowlisted helper files and packs `dist/reproduction-kit.tar.gz`. It never runs installation commands or downloads models.

## What the initial measurements show

- MTP/FP8 served up to 146,920 input tokens with thinking enabled and 146,884 with thinking off within a 150,000-token window. Output headroom matters.
- In the controlled allocation matrix, cold prefill was about 51.5 seconds at 100k, 66.2 at 120k, and 72.5 at 128k. Exact repeats brought this to approximately 0.71–0.73 seconds at 100k and 1.30–1.31 at 128k.
- Low reasoning reduced cold total response time by 17–45% versus xhigh on four 128k tasks, without a consistent quality advantage from xhigh.
- Changing conversations reused cache in 22 of 40 follow-ups. The other 18 had zero cached tokens despite shared prefixes.
- The original 16,282-token incomplete answer ended on a generated EOS, not a configured 16k cap. Sampling and disabling MTP did not reliably solve it. All four final conversation packages had correctness problems.

These initial findings are scoped to synthetic inputs and the measured configurations. Generated code was not executed in the initial study; the separate [quality investigation](docs/quality-investigation.md) adds executable checks. Read [methodology](docs/methodology.md), [the initial report](docs/initial-study.md), and [data definitions](docs/data-format.md) before interpreting differences.

## Update over time

See [adding results](docs/adding-results.md). Add a new immutable JSON snapshot and its checksum to the index using:

```sh
npm run add-snapshot -- /path/to/curated-snapshot.json
npm test
npm run build
```

Snapshots load automatically. The initial study's editorial sections remain tied to its ID; another snapshot shows its own measurements, environment and matched comparison without inheriting those conclusions. The comparison requires matching prompt fingerprints, serving profile, cache counts, request settings and method. Hardware/model/method differences withhold deltas; runtime differences are explicitly flagged.

## Publishing and updates

This repository publishes a GitHub project Pages site. Nothing needs publishing to preview locally. To publish an update:

1. Push the reviewed results-site changes and check the validation workflow.
2. Use **GitHub Actions** as the Pages source under **Settings → Pages → Build and deployment**. This is already configured for the community repository; forks need to configure their own Pages source.
3. Run **Publish results to GitHub Pages** manually, or publish a GitHub release from a tested commit. A source push only runs checks; it does not deploy.
4. The workflow builds `dist/`, uploads it, and deploys to Pages. Relative assets support a project URL such as `/<repository>/`.

The workflow follows [GitHub's custom Pages workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages). Publishing a release in **this results repository** publishes the site; a release in the upstream project does not automatically trigger new inference or publication.

## Evidence boundaries

Only allowlisted numerical measurements, configuration metadata, task briefs, review summaries, and SHA-256 evidence fingerprints are included in the historical snapshots. Original raw prompts and transcripts, personal filesystem paths, private host addresses, authentication material and client-integration instructions are absent. Original evidence is retained separately by the contributor. Source fingerprints identify retained records but do not make them publicly downloadable. The generic installation kit adds a new synthetic smoke probe, not a full independently runnable reproduction of those historical benchmarks.

Not an official HyperQwen benchmark or endorsement. HyperQwen belongs to its upstream contributors; model repositories are linked in each snapshot. No model weights or upstream code are redistributed here.
