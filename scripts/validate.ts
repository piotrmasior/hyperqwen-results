import { readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
import { validateSnapshot } from "./validation.ts";
import { validateInvestigationFiles } from "./validate-investigations.ts";
const root = resolve(import.meta.dirname, "../public/data");
validateInvestigationFiles(resolve(import.meta.dirname, ".."));
const index = JSON.parse(readFileSync(join(root, "index.json"), "utf8"));
if (index.schemaVersion !== 1 || !index.releases.length)
  throw new Error("Invalid data index");
if (
  new Set(index.releases.map((r: any) => r.id)).size !== index.releases.length
)
  throw new Error("Duplicate snapshot ID");
let requests = 0;
for (const entry of index.releases) {
  if (!/^releases\/[a-z0-9-]+\.json$/.test(entry.file))
    throw new Error("Unsafe snapshot path");
  const bytes = readFileSync(join(root, entry.file));
  if (createHash("sha256").update(bytes).digest("hex") !== entry.sha256)
    throw new Error(`Snapshot SHA mismatch: ${entry.id}`);
  const s = validateSnapshot(JSON.parse(bytes.toString()));
  if (
    s.id !== entry.id ||
    entry.file !== `releases/${s.id}.json` ||
    s.label !== entry.label
  )
    throw new Error("Index identity mismatch");
  requests += s.measurements.length;
}
const files = readdirSync(join(root, "releases")).filter((f) =>
  f.endsWith(".json"),
);
if (files.length !== index.releases.length)
  throw new Error("Unindexed snapshot file");
console.log(
  `Validated ${index.releases.length} snapshot(s), ${requests} measurements, checksums and publication-content scan.`,
);
