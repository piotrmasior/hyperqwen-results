# Data format, version 1

`public/data/index.json` lists immutable snapshots, relative file paths, human labels and SHA-256 fingerprints. Each snapshot is in `public/data/releases/<id>.json`. The TypeScript types in `src/data.ts` and runtime validator in `scripts/validation.ts` define the accepted shape.

A snapshot contains:

- Identity: `schemaVersion`, `id`, `label`, `measuredFrom`, `measuredThrough`, `methodVersion`.
- Provenance: full `upstream.revision`, optional release tag, `hardware`, `software`, `model` refs and provenance limitations.
- Serving `profiles`: speculation, drafts, window, cache/backend, memory allocation and applicable numerical settings.
- `groups`: experiment IDs and request counts; `evidence`: source-artifact SHA-256 hashes and row counts.
- `measurements`: one record per actual request; `limits`, `failures`, manual `quality` reviews and scoped `findings`.

The initial file is the complete reference example. Do not clone its measurement values or conclusions to claim a future run. Schema changes require a new version and corresponding validator/UI migration.

## Request fields

| Fields | Contract |
|---|---|
| `id`, `group`, `experiment`, `caseId`, `caseLabel` | Stable workload identity. A group should name the same condition across releases. |
| `evidenceId`, `evidenceRow` | Source artifact fingerprint plus zero-based row index. Not a public raw-log URL. |
| `profile`, `contextLimit`, `concurrency` | Recorded serving configuration and tested concurrency. |
| `reasoning`, `temperature`, `seed`, optional `sampler` | Effective request settings. Initial default thinking is resolved to `xhigh`. |
| `outputAllowance`, `requestedAllowance` | Effective cap and requested cap. These differ in early headroom-limited thinking tests. |
| `cacheMode`, `cachedTokens`, `cacheFraction` | Cold, exact-repeat or follow-up, and measured reuse. |
| `inputTokens`, `outputTokens` | API usage, not character or word estimates. |
| `prefillSeconds`, `decodeSeconds`, `decodeTokensPerSecond`, `wallSeconds` | Separate server and client timings. See methodology. |
| `firstAnswerSeconds` | Client first final-content time; null when absent/unrecorded. |
| `reportedReasoningTokens`, `reasoningTextTokens`, `answerTextTokens` | Recorded API reasoning usage versus retokenized parsed text; null when absent. |
| `finishReason`, `hasAnswer`, `review` | API termination, nonempty final content, and review status. None substitutes for another. |
| `messagesSha256`, `promptTokensSha256`, `answerSha256` | Available request/token/output fingerprints. Null means unavailable. |
| `sharedPrefixWithPreviousInput`, `trimmedInputTokens`, `turn` | Conversation-specific observations; null for other cases. |
| `speculativeAcceptance`, `meanAcceptanceLength` | Recorded speculative metrics; null if not collected/applicable. |
| `lastTokenId`, `ignoreEos` | Token-level termination evidence where collected; diagnostic flag. |

Do not infer a correctness pass from `not-individually-rated`, `hasAnswer` or `stop`. `complete-looking-with-errors` is an intentionally separate state. The reasoning/answer strings themselves are not included.

## Comparison contract

Hardware, model metadata and method must match, otherwise comparisons are withheld. Runtime differences are allowed but visibly flagged as whole-stack comparisons. Within compatible snapshots, a request group matches only with identical experiment/group/task/turn, effective serving profile, prompt-token fingerprint (or message fingerprint when both use that level), actual input/cache counts, cache mode, reasoning, sampling, seed, output cap, window, concurrency and EOS mode. The upstream revision is intentionally allowed to change.

The comparison displays prefill medians and sample counts. Positive percentages mean slower. No significance estimate is implied. Decode and total latency remain available in each ledger; different generated output lengths are not silently labeled an isolated speedup. A matching message fingerprint is weaker than matching rendered input tokens; full transformed weights and custom runtime source state were not hashed in the initial publication.
