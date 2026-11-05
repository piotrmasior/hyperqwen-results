import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import { kitFiles, packageKit } from "../scripts/package-kit.ts";

test("download archive contains only allowlisted source bytes and neutral ownership", () => {
  const root = resolve(import.meta.dirname, "..");
  const directory = mkdtempSync(join(tmpdir(), "hyperqwen-kit-test-"));
  try {
    const path = join(directory, "kit.tar.gz");
    packageKit(root, path);
    const bytes = gunzipSync(readFileSync(path));
    const names: string[] = [];
    const text = (at: number, size: number) =>
      bytes
        .subarray(at, at + size)
        .toString()
        .replace(/\0.*$/s, "")
        .trim();
    for (let at = 0; at < bytes.length && bytes[at] !== 0;) {
      const name = text(at, 100),
        size = parseInt(text(at + 124, 12), 8);
      assert.ok(kitFiles.includes(name), `Unexpected archive member: ${name}`);
      assert.equal(
        parseInt(text(at + 108, 8), 8),
        0,
        "Local user ID must not enter the kit",
      );
      assert.equal(
        parseInt(text(at + 116, 8), 8),
        0,
        "Local group ID must not enter the kit",
      );
      assert.ok(
        ["", "root"].includes(text(at + 265, 32)),
        "Unexpected owner name",
      );
      assert.ok(
        ["", "root"].includes(text(at + 297, 32)),
        "Unexpected group name",
      );
      assert.equal(text(at + 345, 155), "", "Unexpected tar path prefix");
      assert.equal(
        text(at + 156, 1),
        "0",
        "Only ordinary files belong in the kit",
      );
      assert.deepEqual(
        bytes.subarray(at + 512, at + 512 + size),
        readFileSync(join(root, name)),
      );
      names.push(name);
      at += 512 + Math.ceil(size / 512) * 512;
    }
    assert.deepEqual(names, kitFiles);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
