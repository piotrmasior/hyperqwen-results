import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

export function validateInvestigation(data: any) {
  assert.equal(data.schemaVersion, 1);
  assert.match(data.id, /^[a-z0-9-]+$/);
  assert.match(data.upstream.revision, /^[a-f0-9]{40}$/);
  const text = JSON.stringify(data);
  assert.ok(!/\/Users\/|\/home\/|192\.168\.|10\.\d+\.\d+\.\d+|(?:localhost|127\.0\.0\.1):|ssh-|BEGIN .*PRIVATE KEY|gh[pousr]_[A-Za-z0-9]|rawRequest|rawPrompt|server\.env|\.codex/i.test(text), "Private content in investigation data");
  const rows = data.costs.measurements;
  assert.equal(new Set(rows.map((r: any) => r.id)).size, rows.length, "Duplicate measured request");
  for (const row of rows) {
    assert.deepEqual(Object.keys(row).sort(), ["id", "group", "startedUTC", "outputTokens", "wallSeconds", "finishReason"].sort());
    assert.ok(Number.isInteger(row.outputTokens) && row.outputTokens > 0);
    assert.ok(Number.isFinite(row.wallSeconds) && row.wallSeconds > 0);
    assert.ok(!Number.isNaN(Date.parse(row.startedUTC)));
    assert.ok(["stop", "length"].includes(row.finishReason));
    assert.ok(Object.hasOwn(data.costs.groups, row.group));
  }
  assert.equal(rows.length, data.costs.calls);
  assert.equal(rows.reduce((n: number, r: any) => n + r.outputTokens, 0), data.costs.outputTokens);
  assert.ok(Math.abs(rows.reduce((n: number, r: any) => n + r.wallSeconds, 0) - data.costs.wallSeconds) < 1e-6);
  for (const [id, group] of Object.entries<any>(data.costs.groups)) {
    const subset = rows.filter((r: any) => r.group === id);
    assert.equal(subset.length, group.calls);
    assert.equal(subset.reduce((n: number, r: any) => n + r.outputTokens, 0), group.outputTokens);
    assert.ok(Math.abs(subset.reduce((n: number, r: any) => n + r.wallSeconds, 0) - group.wallSeconds) < 0.001);
    assert.equal(subset.filter((r: any) => r.finishReason === "stop").length, group.stop);
    assert.equal(subset.filter((r: any) => r.finishReason === "length").length, group.length);
  }
  for (const p of data.reviewedPackages) {
    for (const hash of [...Object.values(p.files), p.reviewSha256]) assert.match(String(hash), /^[a-f0-9]{64}$/);
    assert.ok(p.firstHeldOutPassed <= p.firstHeldOutTotal);
  }
  assert.equal(data.reviewedPackages.reduce((n: number, p: any) => n + p.firstHeldOutPassed, 0), data.firstHeldOut.passed);
  assert.equal(data.reviewedPackages.reduce((n: number, p: any) => n + p.firstHeldOutTotal, 0), data.firstHeldOut.total);
  for (const p of data.attention.shortProbes) {
    assert.match(p.promptSha256, /^[a-f0-9]{64}$/);
    assert.ok([p.baselineEosPercent, p.attentionBf16EosPercent].every(n => n >= 0 && n <= 100));
    assert.ok(Math.abs(p.baselineEosPercent - p.attentionBf16EosPercent - p.percentagePointReduction) < 1e-9);
  }
  for (const r of data.attention.fullGenerations) {
    assert.ok(r.inputTokens + data.attention.fullRuntime.outputAllowance <= data.attention.fullRuntime.contextLimit);
    assert.ok(r.outputTokens < data.attention.fullRuntime.outputAllowance);
    assert.equal(r.finishReason, "stop");
  }
  for (const s of data.sources) assert.match(s.sha256, /^[a-f0-9]{64}$/);
  return data;
}

export function validateInvestigationFiles(root: string) {
  const dir = join(root, "public/data/investigations");
  const index = JSON.parse(readFileSync(join(dir, "index.json"), "utf8"));
  assert.equal(index.schemaVersion, 1);
  assert.equal(new Set(index.investigations.map((e: any) => e.id)).size, index.investigations.length);
  for (const entry of index.investigations) {
    assert.match(entry.file, /^[a-z0-9-]+\.json$/);
    const bytes = readFileSync(join(dir, entry.file));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), entry.sha256, "Investigation SHA mismatch");
    const data = validateInvestigation(JSON.parse(bytes.toString()));
    assert.equal(data.id, entry.id);
    assert.equal(entry.file, `${data.id}.json`);
  }
  assert.equal(readdirSync(dir).filter(f => f.endsWith(".json")).length, index.investigations.length + 1);
  console.log(`Validated ${index.investigations.length} separate investigation(s), checksums, cost arithmetic and content scan.`);
}
