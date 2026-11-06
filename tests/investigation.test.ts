import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { validateInvestigation } from "../scripts/validate-investigations.ts";
const data = JSON.parse(readFileSync(new URL("../public/data/investigations/2026-11-06-quality-6ab9bd0.json", import.meta.url), "utf8"));

test("published investigation keeps supervised, fresh and held-out results distinct", () => {
  validateInvestigation(data);
  assert.deepEqual(data.outcomes.map((x: any) => [x.id, x.passed, x.total]), [["adaptive", 4, 4], ["fresh45", 0, 4], ["attention-full", 0, 4]]);
  assert.equal(data.firstHeldOut.passed, 11);
  assert.equal(data.firstHeldOut.total, 12);
  assert.deepEqual(["development", "generated", "regression", "reportSQL"].map(k => data.reviewedPackages.reduce((n: number, p: any) => n + p[k], 0)), [100, 156, 12, 9]);
  assert.equal(data.costs.calls, 246);
  assert.equal(data.costs.outputTokens, 3021468);
  assert.equal(data.fresh45.cases.reduce((n: number, c: any) => n + c.calls, 0), 31);
  assert.equal(data.fresh45.cases.reduce((n: number, c: any) => n + c.outputTokens, 0), 416489);
  assert.ok(data.fresh45.cases.every((c: any) => c.implementationCompiles && !c.completePackage && !c.independentSemanticAcceptance));
  assert.equal(data.attention.fullGenerations.reduce((n: number, c: any) => n + c.outputTokens, 0), 55622);
});
test("cost corruption, duplicate records and private paths fail publication validation", () => {
  for (const edit of [
    (d: any) => d.costs.measurements.push(d.costs.measurements[0]),
    (d: any) => d.costs.outputTokens++,
    (d: any) => d.costs.groups[Object.keys(d.costs.groups)[0]].wallSeconds++,
    (d: any) => d.attention.shortProbes[0].percentagePointReduction++,
    (d: any) => d.limits.push("/Users/example/private/log"),
    (d: any) => d.costs.measurements[0].rawPrompt = "unpublished",
  ]) {
    const copy = structuredClone(data); edit(copy); assert.throws(() => validateInvestigation(copy));
  }
});
test("original 149-request published snapshot is byte-for-byte preserved", () => {
  const bytes = readFileSync(new URL("../public/data/releases/2026-11-05-6ab9bd0.json", import.meta.url));
  assert.equal(createHash("sha256").update(bytes).digest("hex"), "2a1e5d80c16b2909c0a0a1993d88bc6041f4e26f02c012f827ec1a58c9c7cf75");
});
