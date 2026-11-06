# Quality investigation · November 5–6, 2026 UTC

Investigation ID: `2026-11-06-quality-6ab9bd0`. Same upstream revision as the initial study: [6ab9bd05cb84b538a6595d634f3e337ac8a80856](https://github.com/syv-ai/HyperQwen/tree/6ab9bd05cb84b538a6595d634f3e337ac8a80856). This is a deeper investigation, not a second release benchmark. [Interactive report](https://piotrmasior.github.io/hyperqwen-results/investigation.html) · [Curated data](https://piotrmasior.github.io/hyperqwen-results/data/investigations/2026-11-06-quality-6ab9bd0.json).

## Result and attribution

All four adaptively repaired packages passed the reviewed original requirements and their hash-pinned checks. Reliable unattended generation remains unproven. A fresh bounded workflow produced 0/4 complete, correct packages; the BF16-attention full-context trial also produced 0/4. These tracks have different protocols and are not a controlled before/after task success-rate comparison.

The local model authored every candidate implementation and edit. An external supervising agent supplied substantial independent tests, source review and diagnostic feedback. Candidate implementations corrected manually by the supervisor are not credited to the model. No original behavioral requirement was removed. Invalid generated tests and assertions that normalized wrong behavior were rejected. Adaptive feedback can teach the development cases; it does not establish generalization.

The historical “1/3” was one complete-looking migration response across three samples. That response still had a correctness defect. It was not a 1/3 correctness baseline. Frozen final-request trials of both fast and base configurations in this investigation scored 0/4 correct and complete.

## Hardware and serving environment

- One NVIDIA GeForce RTX 4090, 24,564 MiB reported memory; 450 W power limit. This is a configured limit, not measured power draw or energy.
- Intel Core i9-14900KF, 32 logical CPUs; 197,866,139,648 bytes system RAM (about 184.3 GiB).
- Ubuntu 26.04.1 LTS, kernel 7.0.0-42-generic; NVIDIA driver 595.91.07.
- Python 3.14.4, vLLM 0.32.0 custom patched build, PyTorch 2.13.0+cu130, Transformers 5.19.0, FlashInfer 0.7.0.post1.
- Qwen3.8-27B W4A16 AutoRound, prepared fast checkpoint. Repository reference: `syvai/qwen3.8-27b-3090-fast-variant` at `124c14e7e8c7d2f5402933b9af368e772a9fcf0c`. Cache refs identify sources; the original prepared weights were not fully content-hashed.
- Usual long-context profile: 150,000 maximum tokens, 30,000 output allowance, low reasoning, temperature 1, top-p 0.95, top-k 20, min-p 0, presence penalty 0, repetition penalty 1; MTP3, FP8 KV, FP16 state, normal final EOS. Initial fast serving used 93% GPU allocation, batch 2,048, maximum four sequences and prefix caching.

The installed template recognizes low/xhigh reasoning effort. Low supplies a brief-thinking instruction; it is not a hard thinking-token budget.

## Four original scenarios and acceptance

The original six-turn engineering conversations concern payment idempotency and expiry, incident recovery and unknown financial exposure, ownership migration, and ingestion/recovery with contiguous offsets. Correctness means preserving their original behavioral invariants, not merely generating plausible files or passing self-authored tests.

The reviewed package replay at 2026-11-06 07:16 UTC used exact archived file hashes and required exact test counts with no skips:

| Scenario | Independent development | Model-generated tests | Reused held-out regression | SQL reporting controls |
|---|---:|---:|---:|---:|
| Payment | 18 | 31 | 3 | 0 |
| Incident | 43 | 34 | 3 | 9 |
| Migration | 25 | 63 | 3 | 0 |
| Ingestion | 14 | 28 | 3 | 0 |
| Total | 100 | 156 | 12 | 9 |

All 24 Node suites and nine SQL controls passed. Do not combine these categories into “277 independent tests.” The **first held-out result remains 11/12**. Migration initially failed a calendar case. A subsequent repair passed that case, but the resulting 12/12 is regression evidence.

Execution used real PostgreSQL 17.11, Node 22.23.4, TypeScript 5.9.3 and pg 8.23.1 inside an isolated Docker sandbox. Provider and broker dependencies were synthetic: no real payment or broker action was performed. Checks were serial, hash-pinned, and stopped at the first failure. Passing these schedules does not establish all possible concurrency outcomes or actual provider guarantees.

Small edits fixed stale-owner fencing, provider attempt identity and time, exact expiry boundaries, unknown-money holds, refund reservation, reporting snapshots, transactional backfill faults, calendar/microsecond handling, and contiguous offsets. Runbook review remained separate because rollback instructions could contradict code.

Limits of the accepted artifacts remain explicit: migration recovery can fail closed on retired-owner rows and has no general historical-quarantine closure API; incident historical unknowns without authoritative claims remain held; ingestion requires verified historical identities and real broker/seek integration. These are reviewed synthetic packages, not a production release.

## Fresh generation and client limitations

Seeds43/44 each generated zero complete packages under a strict frozen artifact protocol (11 measured calls each). The client rejected complete Markdown fences and could not repair missing initial files. Separate extraction diagnostics retained interior bytes and found both packaging failures and real SQL/compiler defects, including actual payment truncation. These are not eight fully evaluated semantic failures.

Seed45 used a prospectively fixed improved protocol: accept a single complete outer fence; apply SQL against the original legacy schema; strictly compile implementation; generate and execute tests; then review a runbook. One initial response plus two replacements per artifact, at most 13 calls per scenario including selection. All six original user turns were retained; a roughly 120k-input source-selection call chose records that were then retained verbatim. Later calls were shorter. No prior successful answer or independent/held-out test source entered the prompts. Feedback contained actual mechanical failures only.

| Scenario | Calls | Output tokens | Request wall seconds | Final blocking condition |
|---|---:|---:|---:|---|
| Payment | 7 | 103,432 | 793.28 | Test compiler error after earlier incomplete test files |
| Incident | 7 | 104,125 | 849.52 | Test compiler errors after earlier incomplete test files |
| Migration | 10 | 128,690 | 1,037.71 | All three test responses incomplete |
| Ingestion | 7 | 80,242 | 653.07 | Test setup failed; 24 tests canceled |

All four implementations compiled. All 31 responses reported normal `stop`. None reached runbook generation. Total: 416,489 output tokens, 3,333.57 seconds request wall time, **0/4 complete and correct**. The ingestion setup failure is not 24 failed semantic assertions.

Independent checks ran against unchanged implementations and were never supplied as repair feedback:

- Payment: an expired 26-hour dispatch called the provider because milliseconds were used as SQL seconds; opaque identifier tuples collided under colon concatenation; populated legacy migration failed before backfill. A separate not-found path threw a PostgreSQL parameter error; no completed funds release is claimed.
- Incident: PostgreSQL BIGINT strings broke expired-claim takeover; a crash before result storage reported zero unknown exposure instead of 1,800 cents. Source changed the provider key with the fence, but an actual double charge was not reproduced in these controls.
- Migration: an ordinary retired-region request sent a payment after cutover; lost response after simulated provider acceptance became definite failure instead of ambiguity.
- Ingestion: completed offsets 0,1,2 did not advance the frontier; acknowledgment was absent; repeated recovery credited 500 cents instead of 250. Generated tests tried to replace the broken frontier SQL and assert the wrong 500-cent result. They were rejected.

One supervisor test initially reused an aborted payment transaction and contaminated a later check. That failure was retained; a fresh-connection rerun established the reported counterexamples. This matters when separating harness faults from model faults.

The client limited repairs to the current artifact: failing test generation could not change an earlier schema/implementation. A future dependency-aware repair experiment should permit that under a frozen budget without weakening assertions. No retrospective retry extension is credited.

## Core and configuration controls

| Intervention | Observation and limit |
|---|---|
| Reasoning-boundary guard | Same 25,894 input-token IDs: unguarded 10,453 output tokens, no answer, 82.35s; guarded 20,603 tokens with an answer, 153.10s. The answer still failed semantic checks. One pair, not a statistical completion estimate. |
| Guard implementation | Server and request opt-in, installed-source hash check, masks stop only before the reasoning boundary including MTP positions; preserves normal final EOS. Five unit tests plus registration/source checks passed. Not promoted. |
| Ignore final EOS | Diagnostic continuation exposed control markers. Not adopted. |
| Remove MTP | Slower decoding; no correctness fix for the evaluated candidate. |
| Shorter thinking budgets | Some faster completions, but compiler/semantic failures. No smaller budget proved correct. |
| Base weights / FP32 state | Each four-scenario trial still failed complete correctness. |
| Int8 KV / backend variant | Two evaluated cases failed; backend changes confound attribution. |
| Restore head or embeddings | Did not explain the incident EOS gap. Dense reconstruction retained it, weakening a packed-kernel-only explanation. |
| Upstream GSM8K | Unmodified protocol: 191/200, 95.5%; thinking off, greedy, cap768, 32 client threads. Different from serial engineering generation. |

A zero-token XGrammar initialization error remains unexplained. Six CPU controls and a structured smoke passed; the failed prompt later succeeded after restart. A retry success is not proof of a source-code fix.

## Attention precision: isolated short-prefix control

The prospective protocol restored all q/k/v/o projections in 16 full-attention layers from the official BF16 reference at `8c0b3d30f3ae96f5c7f774de704bf0ada83e422a`. All 64 restored tensors matched that reference bit for bit; the other 1,830 matched fast. Storage increased by 2,490,366,976 bytes to 18,281,888,656 bytes. Source checkpoints were unchanged.

With identical token hashes and runtime (no MTP, eager, BF16 KV, FP32 state, 65,536 capacity, one sequence), changing only the checkpoint produced:

| Prefix | Tokens | Fast EOS probability | BF16-attention EOS probability |
|---|---:|---:|---:|
| Payment | 50,936 | 24.498611% | 24.502236% |
| Incident | 39,075 | 55.995915% | 13.263738% |

Incident's top token changed from EOS to continuation, meeting the predeclared threshold (at least ten percentage points or a top-token switch). Payment did not materially change. This localizes much of one specific probability gap to the attention projection intervention. It is teacher-forced prefix recomputation, not original incremental-decode logits, a correctness score or evidence for every prompt.

## Attention precision: full-context trial

Three retained startup failures preceded the working 150k configuration:

1. Model-only change at 93% allocation: KV required 5.37 GiB, available 4.76 GiB.
2. 96% allocation: cache sizing passed; a temporary linear-attention buffer ran out of memory.
3. One sequence, eager, batch512: automatic cache allocation of 5.80 GiB exceeded 5.64 GiB physically free.

An explicit **5,800,000,000-byte** KV cache (about 5.402 GiB), one sequence, eager, batch512, 96% GPU allocation started at 150k capacity. Do not confuse 5.8 GB with 5.8 GiB. All four frozen original final requests retained low/T1/seed42, MTP3, FP8 KV, FP16 state, normal final EOS and 30k allowance. Runtime and weights both changed, so generation differences cannot be attributed to weights alone.

| Scenario | Input | Output | Cold prefill seconds | Decode tok/s | Client wall seconds | Completion |
|---|---:|---:|---:|---:|---:|---|
| Payment | 119,993 | 16,398 | 79.26 | 88.46 | 264.79 | Mid-table |
| Incident | 119,953 | 12,299 | 75.07 | 82.96 | 223.47 | Mid-sentence |
| Migration | 119,923 | 14,623 | 75.03 | 82.65 | 252.10 | Unfinished retention section |
| Ingestion | 119,993 | 12,302 | 75.09 | 86.20 | 217.96 | Mid-sentence |

Result: **0/4 complete and correct**, 55,622 output tokens, 958.32 seconds client wall, all normal `stop`, no cache hits or preemptions. Prefill is first scheduled to first generated token; decode is `(output tokens − 1) / server generation seconds`; client wall includes streaming overhead. Model and kernels were loaded: “cold” means uncached input, not process startup.

The same three original incident counterexamples ran against verbatim AST-extracted functions with exports normalized, real PostgreSQL and synthetic dependencies. Expired charge, expired pending refund and explicitly expired ambiguous refund each made one forbidden additional provider call. This was not full-package compilation. The other three outputs were rejected by source/completion review; new behavioral execution is not claimed for them.

Full-prefix probes compared identical input-token hashes under different runtimes: payment fast24.4989% versus combined20.1748%; incident fast67.6284% versus combined59.0922%. These are **not** the isolated short-prefix experiment. Context, KV/state and execution conditions differ between short and full studies; the incident 13.3%→59.1% difference cannot be attributed to context length alone.

No semantic improvement was accepted, so the conditional matched fast-weight/eager quality trial was not triggered. Neither the larger checkpoint nor the tight-memory profile was promoted. There is no demonstrated 16,282-token hard limit; outputs above20k and varied premature-EOS lengths contradict that explanation in the tested path.

## Cost and final state

At 2026-11-06 08:58:38 UTC, the deduplicated ledger contained **246 measured generations, 3,021,468 output tokens and 29,172.981917219 seconds (8.10 hours) of summed request wall time**. Rejected outputs count. The JSON contains per-experiment aggregates and all 246 minimal request records. It excludes startup, CPU tests, teacher-forced probes, GSM transport, external supervision and zero-token failures without final metrics. It is neither total elapsed investigation time nor monetary cost. Group times are rounded to milliseconds; request values retain source precision.

The saved fast150k serving configuration was restored at 08:58 UTC, verified active with a successful warmup and zero restarts. This is a dated observation, not live monitoring. No experimental profile was promoted.

## Reproducing the method on another setup

1. Follow the [general installation runbook](install-remote.md). Pin upstream/model revisions; record effective settings, hardware, power limit and installed runtime versions. Verify the API and retain failures. Do not treat the synthetic smoke probe as a quality benchmark.
2. Freeze your task conversations, required deliverables, legacy schemas, independent behavioral invariants, retry budgets and hold-outs before generating. Record exact rendered token hashes. Keep independent test sources and successful answers out of fresh-generation prompts.
3. Separate loaded-model uncached input, exact-prefix reuse, generation and end-to-end time. Record requested/effective cap, reasoning, sampler, output usage, finish reason and semantic completion separately. Keep partial and rejected outputs.
4. Validate complete artifact extraction, apply schema against representative legacy data, compile code, then execute behavior in an isolated disposable environment. Distinguish setup errors, canceled tests and assertion failures. Use controlled provider/broker substitutes for failure schedules.
5. Review state transitions and runbooks independently. Reject tests that alter delivered implementation or normalize incorrect outcomes. If you adapt a package using failures, label the result supervised development. Reused hold-outs become regression tests; preserve the first score.
6. Retest a frozen bounded workflow from fresh seeds without previous successful artifacts or diagnostic answers. Report client limitations. Do not extend retries retrospectively or reinterpret normal EOS as success.
7. For numerical hypotheses, isolate one variable and verify source identity, weights and rendered tokens. Predeclare the threshold for broader generation trials. Report startup failures and combined runtime changes as such.
8. Preserve checksums, all attempts, costs and limits. Compare future releases only with matched tasks, profiles and methods; treat new datasets and supervision protocols as separate studies.

The public repository provides results, fingerprints, and a general setup kit. Original raw prompts, full candidate packages and the complete experimental harness are retained separately and are **not** downloadable here. Exact historical quality replay therefore cannot be performed from this public repository alone. The steps above reproduce the method on independently prepared tasks, not the exact archived experiment.

## Next hypotheses, not measured improvements

- Dependency-aware bounded repairs: allow schema/implementation changes when test execution exposes a prerequisite defect, while preserving independent assertions and a predeclared total budget.
- Fresh held-out schedules after development: separate acquired knowledge of these four tasks from general reliability.
- Matched runtime numerical controls: isolate attention weights, cache/state precision and execution mode before assigning a generation-quality cause.
- Smaller deliverables and independent runbook review: keep completion gates, normal final EOS, MTP and sufficient output allowance; test the combined workflow prospectively.

No path above is claimed to be a reliable unattended fix yet.
