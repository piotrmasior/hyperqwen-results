import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderGuide, inline } from "../scripts/render-guide.ts";

test("runbook renders every command and section without changing shell bytes", () => {
  const source = readFileSync(
    new URL("../docs/install-remote.md", import.meta.url),
    "utf8",
  );
  const guide = renderGuide(source);
  assert.equal(guide.sectionCount, 16);
  const fences = [...source.matchAll(/```bash\n([\s\S]*?)```/g)];
  assert.equal(guide.codeCount, fences.length);
  assert.ok(guide.codeCount >= 15);
  const blocks = [
    ...guide.body.matchAll(/<code id="command-\d+">([\s\S]*?)<\/code>/g),
  ];
  const unescape = (s: string) =>
    s
      .replaceAll("&lt;", "<")
      .replaceAll("&gt;", ">")
      .replaceAll("&quot;", '"')
      .replaceAll("&#39;", "'")
      .replaceAll("&amp;", "&");
  assert.deepEqual(
    blocks.map((m) => unescape(m[1])),
    fences.map((m) => m[1]),
  );
  assert.match(guide.body, /href="\.\/docs\/methodology.md"/);
  for (const match of guide.toc.matchAll(/href="#([^"]+)"/g))
    assert.ok(guide.body.includes(`id="${match[1]}"`));
});

test("guide fails on unsupported structure and escapes executable-looking input", () => {
  assert.throws(() => renderGuide("## One\n```bash\nhello"), /Unclosed/);
  assert.throws(() => renderGuide("## One\n\n## One"), /Duplicate/);
  assert.throws(() => inline("[bad](javascript:alert)"), /Unsupported/);
  assert.throws(() => inline("[bad](//external.example)"), /Unsupported/);
  assert.equal(
    inline("<script> `a && b`"),
    "&lt;script&gt; <code>a &amp;&amp; b</code>",
  );
});
