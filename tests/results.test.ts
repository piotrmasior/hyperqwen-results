import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { compareSnapshots, median, toCsv } from "../src/data.ts";
import { validateSnapshot } from "../scripts/validation.ts";
const original = JSON.parse(
  readFileSync(
    new URL("../public/data/releases/2026-11-05-6ab9bd0.json", import.meta.url),
    "utf8",
  ),
);
test("initial evidence counts and critical observations survive the export", () => {
  validateSnapshot(original);
  const counts = Object.fromEntries(
    [...new Set(original.measurements.map((r: any) => r.experiment))].map(
      (e) => [
        e,
        original.measurements.filter((r: any) => r.experiment === e).length,
      ],
    ),
  );
  assert.deepEqual(counts, {
    baseline: 8,
    "long-context": 10,
    thinking: 17,
    matrix: 56,
    conversations: 52,
    eos: 2,
    mitigations: 4,
  });
  const eos = original.measurements.find((r: any) => r.group === "eos-normal");
  assert.equal(eos.outputTokens, 16282);
  assert.equal(eos.lastTokenId, 248046);
  assert.equal(eos.outputAllowance, 30000);
  assert.equal(eos.review, "incomplete-and-incorrect");
  const turns = original.measurements.filter(
    (r: any) =>
      r.experiment === "conversations" &&
      r.kind === "conversation" &&
      r.turn > 1,
  );
  assert.equal(turns.length, 40);
  assert.equal(turns.filter((r: any) => r.cachedTokens > 0).length, 22);
  assert.equal(
    original.measurements.find(
      (r: any) =>
        r.experiment === "mitigations" && r.seed === 42 && r.temperature === 1,
    ).outputTokens,
    25250,
  );
});
test("invalid budgets, identities, leakage and numerical inconsistencies are rejected", () => {
  for (const edit of [
    (s: any) => (s.measurements[0].outputAllowance = 70000),
    (s: any) => (s.measurements[0].id = s.measurements[1].id),
    (s: any) => (s.measurements[0].decodeTokensPerSecond = 1),
    (s: any) => (s.label = "/Users/example/private"),
    (s: any) => (s.measurements[0].rawRequest = { secret: "x" }),
  ]) {
    const s = structuredClone(original);
    edit(s);
    assert.throws(() => validateSnapshot(s));
  }
});
// Synthetic copies below exercise comparison logic only. They are never shipped as measurements.
test("only matched workloads compare; runtime changes remain flagged", () => {
  const candidate = structuredClone(original);
  candidate.id = "test-only";
  candidate.upstream.revision = "a".repeat(40);
  for (const r of candidate.measurements) r.prefillSeconds *= 0.9;
  const result = compareSnapshots(original, candidate);
  assert.ok(result.matched > 100);
  assert.equal(result.blocked, false);
  assert.ok(result.rows.every((r) => Math.abs(r.changePercent + 10) < 1e-8));
  candidate.software.vllm = "different-build";
  assert.deepEqual(compareSnapshots(original, candidate).differences, [
    "software",
  ]);
  candidate.hardware.gpu = "different-gpu";
  assert.equal(compareSnapshots(original, candidate).blocked, true);
});
test("changed prompts, cache conditions, profile and caps are never silently paired", () => {
  const source = structuredClone(original);
  source.measurements = source.measurements.filter(
    (r: any) => r.group === "eos-normal",
  );
  for (const edit of [
    (r: any) => (r.messagesSha256 = "a".repeat(64)),
    (r: any) => (r.cachedTokens = 10),
    (r: any) => (r.outputAllowance = 20000),
    (r: any) => (r.temperature = 0.7),
  ]) {
    const copy = structuredClone(source);
    copy.measurements[0].promptTokensSha256 = null;
    source.measurements[0].promptTokensSha256 = null;
    edit(copy.measurements[0]);
    assert.equal(compareSnapshots(source, copy).matched, 0);
  }
  const copy = structuredClone(source);
  copy.profiles.find((p: any) => p.id === "mtp-150k").draftTokens = 5;
  assert.equal(compareSnapshots(source, copy).matched, 0);
});
test("median handles repetitions and CSV escapes source labels", () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([1, 4]), 2.5);
  assert.equal(median([]), null);
  const r = structuredClone(original.measurements[0]);
  r.caseLabel = 'A "quoted", task';
  const csv = toCsv([r]);
  assert.ok(csv.includes('"A ""quoted"", task"'));
  assert.equal(csv.split("\r\n").length, 3);
});
