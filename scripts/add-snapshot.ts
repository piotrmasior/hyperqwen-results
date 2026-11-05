import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
import { validateSnapshot } from "./validation.ts";
const input = process.argv[2];
if (!input)
  throw new Error(
    "Usage: npm run add-snapshot -- /path/to/curated-snapshot.json",
  );
const root = resolve(import.meta.dirname, "../public/data");
const snapshot = validateSnapshot(
  JSON.parse(readFileSync(resolve(input), "utf8")),
);
const index = JSON.parse(readFileSync(join(root, "index.json"), "utf8"));
const file = `releases/${snapshot.id}.json`,
  target = join(root, file);
if (existsSync(target) || index.releases.some((r: any) => r.id === snapshot.id))
  throw new Error("Snapshots are immutable. Use a new unique ID.");
const bytes = JSON.stringify(snapshot, null, 2) + "\n";
const entry = {
  id: snapshot.id,
  label: snapshot.label,
  file,
  sha256: createHash("sha256").update(bytes).digest("hex"),
};
writeFileSync(target, bytes, { flag: "wx" });
index.releases.push(entry);
writeFileSync(join(root, "index.json"), JSON.stringify(index, null, 2) + "\n");
console.log(
  `Added ${snapshot.id}. Run npm test and npm run build; review before publication.`,
);
