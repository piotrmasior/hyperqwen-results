import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  cpSync,
  rmSync,
  readdirSync,
} from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { resolve, join } from "node:path";
const root = resolve(import.meta.dirname, "..");
rmSync(join(root, "dist"), { recursive: true, force: true });
mkdirSync(join(root, "dist"), { recursive: true });
cpSync(join(root, "public"), join(root, "dist"), { recursive: true });
cpSync(join(root, "docs"), join(root, "dist", "docs"), { recursive: true });
for (const file of readdirSync(join(root, "src")).filter((f) =>
  f.endsWith(".ts"),
)) {
  const code = stripTypeScriptTypes(
    readFileSync(join(root, "src", file), "utf8"),
    { mode: "strip" },
  ).replaceAll(/(from\s+["'])(\.\/[^"']+)\.ts(["'])/g, "$1$2.js$3");
  writeFileSync(join(root, "dist", file.replace(/\.ts$/, ".js")), code);
}
writeFileSync(join(root, "dist", ".nojekyll"), "");
console.log("Built dist/ — relative assets support project-path GitHub Pages.");
