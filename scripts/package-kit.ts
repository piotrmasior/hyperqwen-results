import { execFileSync } from "node:child_process";

export const kitFiles = [
  "docs/install-remote.md",
  "docs/methodology.md",
  "docs/adding-results.md",
  "reproduce/prepare-native.py",
  "reproduce/probe.py",
  "reproduce/profiles/dflash2-64k.env",
  "reproduce/profiles/mtp-150k.env",
];

export function packageKit(root: string, destination: string) {
  const bsd = execFileSync("tar", ["--version"], { encoding: "utf8" }).includes(
    "bsdtar",
  );
  const owner = bsd
    ? ["--uid=0", "--gid=0", "--uname=root", "--gname=root"]
    : ["--owner=0", "--group=0", "--numeric-owner"];
  // Ustar excludes extended attributes; owner fields must not disclose local accounts.
  // Only these files enter the archive, never logs, caches or research checkouts.
  execFileSync(
    "tar",
    ["--format=ustar", ...owner, "-czf", destination, "-C", root, ...kitFiles],
    {
      env: { ...process.env, COPYFILE_DISABLE: "1" },
    },
  );
}
