export type Measurement = {
  id: string;
  experiment: string;
  group: string;
  caseId: string;
  caseLabel: string;
  profile: string;
  evidenceId: string;
  evidenceRow: number;
  kind: string;
  cacheMode: string;
  reasoning: string;
  temperature: number;
  seed: number;
  outputAllowance: number;
  requestedAllowance: number;
  contextLimit: number;
  concurrency: number;
  firstAnswerSeconds: number | null;
  ignoreEos: boolean;
  messagesSha256: string | null;
  promptTokensSha256: string | null;
  answerSha256: string | null;
  startedUTC: string | null;
  turn: number | null;
  inputTokens: number;
  cachedTokens: number;
  outputTokens: number;
  prefillSeconds: number;
  decodeSeconds: number;
  decodeTokensPerSecond: number;
  wallSeconds: number;
  queueSeconds: number;
  preemptions: number;
  reasoningTextTokens: number | null;
  answerTextTokens: number | null;
  reportedReasoningTokens: number | null;
  hasAnswer: boolean;
  finishReason: string;
  sharedPrefixWithPreviousInput: number | null;
  cacheFraction: number;
  trimmedInputTokens: number | null;
  speculativeAcceptance: number | null;
  meanAcceptanceLength: number | null;
  review: string;
  sampler?: Record<string, number>;
  lastTokenId?: number | null;
};
export type Snapshot = {
  schemaVersion: number;
  id: string;
  label: string;
  measuredFrom: string;
  measuredThrough: string;
  methodVersion: string;
  upstream: {
    name: string;
    url: string;
    revision: string;
    releaseTag: string | null;
  };
  hardware: Record<string, string | number>;
  software: Record<string, string>;
  model: {
    name: string;
    quantization: string;
    repositories: { repository: string; ref: string; revision: string }[];
    provenanceLimit: string;
  };
  profiles: Record<string, any>[];
  groups: { id: string; experiment: string; requests: number }[];
  evidence: { id: string; kind: string; sha256: string; rows: number }[];
  measurements: Measurement[];
  limits: string[];
  failures: { stage: string; detail: string }[];
  quality: {
    caseId: string;
    title: string;
    finding: string;
    severity: string;
  }[];
  findings: Record<string, number>;
};
export const experimentLabels: Record<string, string> = {
  baseline: "64k baseline",
  "long-context": "150k context",
  thinking: "Thinking budgets",
  matrix: "Context / effort matrix",
  conversations: "Agent conversations",
  eos: "EOS diagnosis",
  mitigations: "Stop mitigations",
};
export const cases = [
  "01-code-review",
  "02-incident",
  "03-architecture",
  "04-long-audit",
];
export const caseLabels = [
  "Payment repair",
  "Incident recovery",
  "Migration design",
  "Pipeline audit",
];
export const median = (values: number[]) => {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b),
    m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const canonical = (x: any): string =>
  x && typeof x === "object"
    ? Array.isArray(x)
      ? `[${x.map(canonical).join(",")}]`
      : `{${Object.keys(x)
          .sort()
          .map((k) => `${JSON.stringify(k)}:${canonical(x[k])}`)
          .join(",")}}`
    : JSON.stringify(x);

// Runtime differences stay visible, but are not automatically attributed to the upstream revision.
export function compareSnapshots(before: Snapshot, after: Snapshot) {
  const differences = ["hardware", "software", "model", "methodVersion"].filter(
    (k) => canonical((before as any)[k]) !== canonical((after as any)[k]),
  );
  if (
    differences.includes("hardware") ||
    differences.includes("model") ||
    differences.includes("methodVersion")
  )
    return { differences, matched: 0, rows: [], blocked: true };
  const key = (r: Measurement, s: Snapshot) => {
    if (!r.promptTokensSha256 && !r.messagesSha256) return null;
    const profile = s.profiles.find((p) => p.id === r.profile);
    if (!profile) return null;
    return canonical({
      experiment: r.experiment,
      group: r.group,
      caseId: r.caseId,
      turn: r.turn,
      kind: r.kind,
      inputHash: r.promptTokensSha256 || r.messagesSha256,
      hashType: r.promptTokensSha256 ? "tokens" : "messages",
      inputTokens: r.inputTokens,
      cachedTokens: r.cachedTokens,
      cacheMode: r.cacheMode,
      profile,
      reasoning: r.reasoning,
      temperature: r.temperature,
      seed: r.seed,
      sampler: r.sampler || null,
      cap: r.outputAllowance,
      context: r.contextLimit,
      concurrency: r.concurrency,
      ignoreEos: r.ignoreEos,
    });
  };
  const group = (s: Snapshot) => {
    const m = new Map<string, Measurement[]>();
    for (const r of s.measurements) {
      const k = key(r, s);
      if (k) m.set(k, [...(m.get(k) || []), r]);
    }
    return m;
  };
  const a = group(before),
    b = group(after),
    rows: any[] = [];
  for (const [k, oldRows] of a) {
    const newRows = b.get(k);
    if (!newRows) continue;
    const oldValue = median(oldRows.map((r) => r.prefillSeconds))!,
      newValue = median(newRows.map((r) => r.prefillSeconds))!;
    rows.push({
      label: oldRows[0].caseLabel,
      group: oldRows[0].group,
      cacheMode: oldRows[0].cacheMode,
      before: oldValue,
      after: newValue,
      changePercent: (newValue / oldValue - 1) * 100,
      beforeN: oldRows.length,
      afterN: newRows.length,
    });
  }
  return { differences, matched: rows.length, rows, blocked: false };
}
export function toCsv(rows: Measurement[]) {
  const fields = [
    "id",
    "experiment",
    "group",
    "caseLabel",
    "profile",
    "reasoning",
    "temperature",
    "seed",
    "cacheMode",
    "inputTokens",
    "cachedTokens",
    "outputAllowance",
    "outputTokens",
    "reasoningTextTokens",
    "prefillSeconds",
    "decodeTokensPerSecond",
    "firstAnswerSeconds",
    "wallSeconds",
    "finishReason",
    "review",
    "evidenceId",
    "evidenceRow",
  ] as const;
  const cell = (v: any) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  return (
    [
      fields.join(","),
      ...rows.map((r) => fields.map((f) => cell(r[f])).join(",")),
    ].join("\r\n") + "\r\n"
  );
}
