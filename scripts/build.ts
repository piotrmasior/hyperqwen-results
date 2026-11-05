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
import { renderGuide } from "./render-guide.ts";
import { kitFiles, packageKit } from "./package-kit.ts";
const root = resolve(import.meta.dirname, "..");
rmSync(join(root, "dist"), { recursive: true, force: true });
mkdirSync(join(root, "dist"), { recursive: true });
cpSync(join(root, "public"), join(root, "dist"), { recursive: true });
cpSync(join(root, "docs"), join(root, "dist", "docs"), { recursive: true });
for (const file of kitFiles.filter((file) => file.startsWith("reproduce/"))) {
  mkdirSync(resolve(root, "dist", file, ".."), { recursive: true });
  cpSync(join(root, file), join(root, "dist", file));
}
packageKit(root, join(root, "dist/reproduction-kit.tar.gz"));
const guide = renderGuide(
  readFileSync(join(root, "docs/install-remote.md"), "utf8"),
);
const template = readFileSync(join(root, "templates/install.html"), "utf8");
writeFileSync(
  join(root, "dist/install.html"),
  template
    .replace("{{INTRO}}", () => guide.intro)
    .replace("{{TOC}}", () => guide.toc)
    .replace("{{BODY}}", () => guide.body),
);
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
