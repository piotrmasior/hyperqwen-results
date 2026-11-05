# Measurement method

The initial study covers 2026-11-04–05 UTC on one RTX 4090 / i9-14900KF system. All measured inference was serial, with loaded weights and kernels. Maximum configured sequences was four, but concurrency above one was not tested. The upstream revision, model cache refs, package versions and serving profiles are embedded in the snapshot.

## Definitions

| Field | Meaning |
|---|---|
| Input | Full chat-template token count, not raw text size. Token units are decimal. |
| Output allowance | Per-response maximum, including reasoning. Input plus this allowance must fit the serving window. |
| Prefill seconds | Server first-scheduled to first-generated-token interval. Includes the first generated token; not a GPU-kernel-only timing. |
| Decode tokens/s | `(outputTokens - 1) / decodeSeconds`, including reasoning. |
| First answer seconds | Client time to final-content text. In matrix data this is the first non-whitespace chunk; earlier tests used the first content chunk. Null means unavailable/no final-content event. |
| Total seconds | Client request-to-final-response time, including LAN/streaming overhead. Excludes model startup, prompt construction and tokenization preparation. |
| Cold | No cached input tokens. The process/model/kernels are already warm. |
| Exact repeat | Identical serialized prompt replayed immediately with retained prefix cache. It reuses input processing; it does not reuse the generated answer. |
| Follow-up | Changed conversation history, sometimes with background trimming. Actual cached tokens are reported separately. |
| API stop | Transport/generation outcome; not evidence that requested work is complete or correct. |

Reasoning/final text counts come from retokenized parsed text when recorded. They need not sum to API output usage because of message delimiters. Null means not recorded, not zero. All original numerical precision is preserved in JSON; charts round for readability.

## Workloads

Four synthetic dossiers contain decisive task records amid unrelated background notes:

1. **Payment repair:** tenant-scoped identity, atomic balances, ambiguous provider outcomes, outbox and rollback.
2. **Incident recovery:** duplicate charges, lock-unit errors, evidence timelines, charge/refund reconciliation and idempotency windows.
3. **Migration design:** writer ownership, tenant uniqueness, online backfill, retention, residency and rollback.
4. **Pipeline audit:** atomic credits, processed markers, offsets, tenant-aware caching and historical recovery.

The initial scaling cases have different tasks at different sizes. Connecting their points is descriptive, not proof that input length alone caused each change. The matrix keeps decisive record bytes/order while varying unrelated background. Thinking modes add different template tokens; their measured input counts are retained.

The six-turn extension supplies fixed tool/file/test observations as user messages. Actual final answers become history; reasoning is not resubmitted. Every user turn and decisive source record is retained. Background NOTE records are removed from the tail to keep input at or below 120,000 tokens. This is not append-only history with spare headroom. Generated code, tests, refunds and replay operations were not executed.

## Experiment accounting

| Experiment | Requests | Design |
|---|---:|---|
| Baseline | 8 | Four tasks, DFlash2 64k, cold + exact repeat, thinking off |
| Long context | 10 | Four expanded tasks plus 49k same-prompt control, MTP 150k, cold + repeat |
| Thinking budgets | 17 | Matched 2,048 cap, extended budgets, architecture retry and audit headroom controls |
| Context/effort matrix | 56 | Five allocations; selected timing repeats/cache; off/low/xhigh |
| Conversations | 52 | Four tasks × six turns × two caps, plus four cold final-turn controls |
| EOS diagnosis | 2 | Exact replay with token reporting; bounded ignore-EOS diagnostic |
| Mitigations | 4 | Three sampled seeds and one no-MTP greedy control |
| **Total** | **149** | Warmups, acceptance probes and setup failures excluded |

MTP long-context uses three draft tokens, FP8 KV, FlashInfer and a 150,000-token window. DFlash2 fast uses seven draft tokens, BF16 KV and 65,536 tokens. This is a whole-profile change. No-MTP uses an 800-token block/cache capacity of 237,563 versus MTP's 832/200,502; numerical paths and allocation are not perfectly isolated.

The ordinary requests use temperature 0 and seed 42. Matrix default thinking maps to xhigh; low uses an explicit effort instruction. Sampled mitigations use temperature 1, top-p .95, top-k 20, min-p 0, presence penalty 0, repetition penalty 1 and seeds 42–44. Normal EOS handling remains enabled except for the one explicitly marked diagnostic.

## Review and uncertainty

Quality judgments are manual and non-blinded, against supplied scenario invariants. No universal accuracy score, statistical significance, population success rate, or p95 is estimated. Most cells have one observation. Selected matrix settings have three cold repetitions per task; those are timing repeats of the same input, not independent quality samples. Different output lengths make total-response ratios task costs, not fixed-output throughput comparisons.

Here, “manual review” describes source/answer inspection rather than executable evaluation. The retained notes do not establish independent human validation. Treat the findings as qualitative review observations, not a certified correctness assessment.

The long-context study sampled whole-GPU memory every second, with a maximum of 23,836 MiB out of 24,564 MiB. The matrix sampled every five seconds: 23,832 MiB during measured inference, 24,046 including startup/restoration. Conversation samples peaked at 23,832 MiB and 76°C. These are sampled maxima, not continuous peak-memory profiles. They do not establish safe concurrency or reserve headroom for other workloads.

Preparation/startup failures are described in the snapshot. They are not counted as completed inference requests and are not silently presented as fault-free setup. Zero measured preemptions do not imply no setup faults.

## Provenance and reproducibility

Each exported request points to an evidence ID and zero-based source row. Evidence IDs carry SHA-256 fingerprints of retained source measurement artifacts. Every snapshot has its own SHA-256 in the index, checked at build time and in the browser. These checks detect accidental edits; they are not signatures or independent verification.

The public repository omits original prompts/transcripts, machine logs, and the deployment harness. Exact inference reproduction from this repository alone is therefore not possible. It does support independently recomputing aggregates and inspecting every exported measurement. Model refs identify observed cache revisions, not full hashes of all locally prepared weight files. A custom-patched vLLM package version does not fully identify its binary/source state.

The [remote installation runbook](install-remote.md) and bundled helpers reproduce the reference serving profiles with explicitly pinned model refs. Their two-request synthetic probe checks API operation and timing fields, not the historical workloads. Source inspection and offline helper tests do not establish a fresh GPU installation test.

For stronger future reproduction, attach separately reviewed synthetic fixtures and serving build fingerprints. Do not label them matched until their full rendered prompt fingerprints, settings and method actually match.
