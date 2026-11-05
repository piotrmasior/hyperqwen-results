import type { Snapshot } from "../src/data.ts";
const assertion = (ok: any, message: string) => {
  if (!ok) throw new Error(message);
};
const allowed = (value: any, keys: string[], label: string) => {
  assertion(
    value && typeof value === "object" && !Array.isArray(value),
    `${label}: expected object`,
  );
  for (const k of Object.keys(value))
    assertion(keys.includes(k), `${label}: unknown field ${k}`);
};
const hash = (value: any) =>
  typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const identifier = (value: any) =>
  typeof value === "string" && /^[a-z0-9-]+$/.test(value);
export function validateSnapshot(s: Snapshot) {
  allowed(
    s,
    [
      "schemaVersion",
      "id",
      "label",
      "measuredFrom",
      "measuredThrough",
      "methodVersion",
      "upstream",
      "hardware",
      "software",
      "model",
      "profiles",
      "groups",
      "evidence",
      "measurements",
      "limits",
      "failures",
      "quality",
      "findings",
    ],
    "snapshot",
  );
  assertion(s.schemaVersion === 1, "Unknown schema version");
  assertion(identifier(s.id), "Unsafe snapshot ID");
  for (const k of ["measuredFrom", "measuredThrough"])
    assertion(
      /^\d{4}-\d{2}-\d{2}$/.test((s as any)[k]),
      `${k}: invalid UTC date`,
    );
  assertion(s.measuredFrom <= s.measuredThrough, "Reversed measurement dates");
  assertion(
    /^[a-f0-9]{40}$/.test(s.upstream.revision),
    "Expected full upstream SHA",
  );
  assertion(
    s.upstream.url === "https://github.com/syv-ai/HyperQwen",
    "Unexpected upstream URL",
  );
  allowed(
    s.hardware,
    ["gpu", "gpuCount", "vramMiB", "cpu", "logicalCpus", "ramBytes"],
    "hardware",
  );
  assertion(
    Number(s.hardware.vramMiB) > 0 && Number(s.hardware.ramBytes) > 0,
    "Missing hardware capacity",
  );
  allowed(
    s.software,
    [
      "os",
      "kernel",
      "nvidiaDriver",
      "python",
      "torch",
      "vllm",
      "flashinfer",
      "transformers",
    ],
    "software",
  );
  assertion(s.measurements.length > 0, "Empty snapshot");
  const unique = (values: string[], label: string) =>
    assertion(new Set(values).size === values.length, `Duplicate ${label}`);
  unique(
    s.measurements.map((r) => r.id),
    "measurement ID",
  );
  unique(
    s.evidence.map((e) => e.id),
    "evidence ID",
  );
  unique(
    s.groups.map((g) => g.id),
    "group ID",
  );
  unique(
    s.profiles.map((p) => p.id),
    "profile ID",
  );
  const fields = [
    "id",
    "experiment",
    "group",
    "caseId",
    "caseLabel",
    "profile",
    "evidenceId",
    "evidenceRow",
    "kind",
    "cacheMode",
    "reasoning",
    "temperature",
    "seed",
    "outputAllowance",
    "requestedAllowance",
    "contextLimit",
    "concurrency",
    "firstAnswerSeconds",
    "ignoreEos",
    "messagesSha256",
    "promptTokensSha256",
    "answerSha256",
    "startedUTC",
    "turn",
    "inputTokens",
    "cachedTokens",
    "outputTokens",
    "prefillSeconds",
    "decodeSeconds",
    "decodeTokensPerSecond",
    "wallSeconds",
    "queueSeconds",
    "preemptions",
    "reasoningTextTokens",
    "answerTextTokens",
    "reportedReasoningTokens",
    "hasAnswer",
    "finishReason",
    "sharedPrefixWithPreviousInput",
    "cacheFraction",
    "trimmedInputTokens",
    "sampler",
    "speculativeAcceptance",
    "meanAcceptanceLength",
    "review",
    "lastTokenId",
  ];
  for (const r of s.measurements) {
    allowed(r, fields, r.id);
    assertion(
      s.profiles.some((p) => p.id === r.profile),
      `${r.id}: missing profile`,
    );
    assertion(
      s.groups.some((g) => g.id === r.group && g.experiment === r.experiment),
      `${r.id}: missing group`,
    );
    const evidence = s.evidence.find((e) => e.id === r.evidenceId);
    assertion(
      evidence &&
        Number.isInteger(r.evidenceRow) &&
        r.evidenceRow >= 0 &&
        r.evidenceRow < evidence.rows,
      `${r.id}: invalid evidence row`,
    );
    for (const key of [
      "inputTokens",
      "cachedTokens",
      "outputTokens",
      "outputAllowance",
      "contextLimit",
      "prefillSeconds",
      "decodeSeconds",
      "decodeTokensPerSecond",
      "wallSeconds",
      "queueSeconds",
      "preemptions",
    ])
      assertion(
        Number.isFinite((r as any)[key]) && (r as any)[key] >= 0,
        `${r.id}: invalid ${key}`,
      );
    for (const key of [
      "inputTokens",
      "cachedTokens",
      "outputTokens",
      "outputAllowance",
      "contextLimit",
    ])
      assertion(
        Number.isInteger((r as any)[key]),
        `${r.id}: fractional tokens`,
      );
    assertion(
      r.outputTokens <= r.outputAllowance,
      `${r.id}: output exceeds cap`,
    );
    assertion(
      r.inputTokens + r.outputAllowance <= r.contextLimit,
      `${r.id}: context budget overflow`,
    );
    assertion(
      r.cachedTokens <= r.inputTokens,
      `${r.id}: impossible cache count`,
    );
    assertion(
      Math.abs(r.cacheFraction - r.cachedTokens / r.inputTokens) < 1e-9,
      `${r.id}: inconsistent cache fraction`,
    );
    assertion(
      ["cold", "exact-repeat", "follow-up"].includes(r.cacheMode),
      `${r.id}: invalid cache mode`,
    );
    if (r.cacheMode === "cold")
      assertion(r.cachedTokens === 0, `${r.id}: cold cache is nonempty`);
    if (r.cacheMode === "exact-repeat")
      assertion(r.cachedTokens > 0, `${r.id}: repeat has no cache`);
    assertion(
      ["stop", "length"].includes(r.finishReason),
      `${r.id}: unknown outcome`,
    );
    for (const key of ["messagesSha256", "promptTokensSha256", "answerSha256"])
      assertion(
        (r as any)[key] === null || hash((r as any)[key]),
        `${r.id}: invalid fingerprint`,
      );
    const calculated = (r.outputTokens - 1) / r.decodeSeconds;
    assertion(
      Math.abs(calculated - r.decodeTokensPerSecond) < 0.01,
      `${r.id}: inconsistent decode rate`,
    );
    assertion(
      r.wallSeconds >= r.prefillSeconds,
      `${r.id}: wall time shorter than prefill`,
    );
  }
  for (const e of s.evidence) {
    assertion(hash(e.sha256), "Invalid evidence SHA");
    assertion(
      s.measurements.filter((r) => r.evidenceId === e.id).length === e.rows,
      `${e.id}: row count mismatch`,
    );
  }
  for (const g of s.groups)
    assertion(
      s.measurements.filter((r) => r.group === g.id).length === g.requests,
      `${g.id}: row count mismatch`,
    );
  // Defense in depth only: curated export + manual review remain necessary.
  const serialized = JSON.stringify(s);
  assertion(
    !/(?:\/Users\/|\/home\/|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|BEGIN [A-Z ]*PRIVATE KEY|ssh-(?:rsa|ed25519) |codex|lmstudio|bionic|local_ai_ubuntu|@[a-z0-9.-]+\.(?:com|net|org))/i.test(
      serialized,
    ),
    "Publication-sensitive content detected",
  );
  return s;
}
