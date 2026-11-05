# Initial study: 6ab9bd0

Measured November 4–5, 2026 UTC. Machine: RTX 4090 (24,564 MiB), i9-14900KF, 197,866,139,648 bytes visible RAM. Ubuntu 26.04.1 LTS / kernel 7.0.0-42-generic, driver 595.91.07, Python 3.14.4, PyTorch 2.13.0+cu130, custom vLLM 0.32.0, FlashInfer 0.7.0.post1, Transformers 5.19.0.

## Context scaling and cache

| Thinking-off input | Profile | Cold prefill s | Repeated prefill s | Cold decode tok/s |
|---:|---|---:|---:|---:|
| 2,026 | DFlash2 64k | 0.698 | 0.243 | 174.7 |
| 8,224 | DFlash2 64k | 2.838 | 0.224 | 166.8 |
| 24,569 | DFlash2 64k | 9.086 | 0.346 | 142.8 |
| 49,129 | DFlash2 64k | 19.985 | 0.391 | 147.4 |
| 49,129 | MTP 150k control | 20.799 | 0.502 | 126.6 |
| 65,542 | MTP 150k | 29.72 | 0.92 | 114.0 |
| 98,188 | MTP 150k | 50.30 | 0.68 | 117.0 |
| 130,925 | MTP 150k | 74.70 | 1.05 | 112.2 |
| 146,884 | MTP 150k | 88.04 | 1.18 | 110.4 |

Each row is one task/condition, not a distribution. The matrix's 100k and 128k inputs had three cold observations per task and one repeat: repeat prefill was 0.71–0.73 and 1.30–1.31 seconds respectively. These favorable exact-repeat cases are not representative of all conversation turns.

At a 120k conversation envelope, 22 of 40 follow-ups reused cache, with 2.77–20.44 seconds of prefill. Eighteen had zero cached tokens, around 66 seconds of prefill, despite sharing 76,432–104,863 initial token IDs with the preceding request. The cache allocator was not traced, so no single cause is assigned to individual misses.

## Reasoning and output budget

All four xhigh tasks with a 2,048 output allowance used it on reasoning without a final answer. Expanded budgets completed some tasks; a 147k input left too little room. The 132.6k audit with a 16,384 allowance completed in 136.40 seconds with thinking versus 84.09 without it. Longer thinking did not consistently resolve the quality issues.

At 128k/20k, off/low/xhigh cold total times were:

| Task | Off s | Low s | Xhigh s |
|---|---:|---:|---:|
| Payment | 79.17 | 90.56 | 164.74 |
| Incident | 79.67 | 84.72 | 115.59 |
| Migration | 79.54 | 102.72 | 124.09 |
| Pipeline | 80.27 | 92.76 | 149.86 |

All eight matrix 20k/30k cap pairs had identical reasoning and final answers. All 24 six-turn cap pairs had identical final answers and input tokens. Conversation output ranged 3,109–16,282 tokens; reaching neither cap did not establish deliverable completeness.

## Premature EOS

The migration handoff ended at `### 6.1 Test: Back` with EOS token 248046 at generated position 16,282. Its normal replay exactly matched the earlier answer. Ignoring EOS retained all 16,282 generated token IDs and reached the diagnostic cap of 18,000, but produced new message markers and a fresh reasoning segment. The tested path was not limited to 16k output.

| Condition | Output | Decode tok/s | Total s | Review |
|---|---:|---:|---:|---|
| MTP greedy prior control | 16,282 | 120.0 | 201.86 | Mid-heading |
| MTP sampled seed 42 | 25,250 | 106.4 | 303.41 | Complete-looking, unsafe backfill cursor |
| MTP sampled seed 43 | 14,665 | 115.6 | 193.26 | Mid-comment |
| MTP sampled seed 44 | 13,319 | 118.9 | 178.41 | Partial table |
| No MTP greedy | 17,610 | 46.4 | 444.51 | Mid-string |

Neither sampled settings nor disabling MTP reliably fixed this one reproducer. MTP is not necessary for premature EOS to occur; this does not isolate base-model behavior from quantization and other inference numerics. The complete-looking sampled answer exceeded 20k, supporting a 30k reserve for future experiments but not proving it is always sufficient.

## Quality and next investigations

Every final conversation package required correction: payment expiry/side effects, stale incident recovery claims, migration fencing/backfill/retention, and pipeline offset/rollback/identity handling. The model often found important source facts while producing unsafe repairs. Completion and correctness should be measured separately.

Useful future controlled experiments include executable acceptance checks on smaller per-file outputs; bounded continuation requests; exact fixture replays on newer upstream revisions; and matched checkpoint/quantization/backend comparisons. These are proposed investigations, not measured improvements in this snapshot.
