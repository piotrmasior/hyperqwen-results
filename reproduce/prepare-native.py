#!/usr/bin/env python3
"""Generate pinned native preparation scripts; never install or download anything.

Run with the fresh, exact upstream checkout as the only argument, then inspect
the generated files and execute .setup/prepare-native.sh using the runbook.
"""
import ast
import json
import pathlib
import re
import subprocess
import sys

UPSTREAM = "6ab9bd05cb84b538a6595d634f3e337ac8a80856"
MODEL_REVISIONS = {
    "dbirks/Qwen3.8-27B-W4A16-AutoRound": "1f05c441c4e64ae0549de44fa9ea5a6d43610314",
    "syvai/qwen3.8-27b-3090-fast-variant": "124c14e7e8c7d2f5402933b9af368e772a9fcf0c",
    "syvai/Qwen3.8-27B-DFlash2-W4A16": "4d30ec736ffc6b8688dc2ae2b502d9b48bdec279",
}


def replace_once(source, old, new):
    if source.count(old) != 1:
        raise ValueError(f"Expected one source pattern: {old!r}; upstream differs")
    return source.replace(old, new, 1)


def generate(root):
    root = pathlib.Path(root).resolve()
    # Upstream's container preparation embeds shell paths without quoting.
    if not re.fullmatch(r"/[A-Za-z0-9_./-]+", str(root)):
        raise ValueError("Use an absolute installation path without spaces or shell metacharacters")
    pin = subprocess.check_output(["git", "-C", str(root), "rev-parse", "HEAD"], text=True).strip()
    if pin != UPSTREAM:
        raise ValueError("This adapter supports only the documented upstream commit")
    dirty = subprocess.check_output(["git", "-C", str(root), "diff", "HEAD", "--", "docker/prepare.sh", "prepare/fetch_fast_variant.py", "prepare/fetch_dflash2.py"], text=True)
    if dirty:
        raise ValueError("Preparation sources have local edits; inspect them before adapting")
    setup = root / ".setup"
    setup.mkdir(exist_ok=True)
    (root / "models").mkdir(exist_ok=True)
    outputs = {}
    for filename, pattern, replacement in [
        ("fetch_fast_variant.py", 'snapshot_download("syvai/qwen3.8-27b-3090-fast-variant",',
         'snapshot_download("syvai/qwen3.8-27b-3090-fast-variant", revision=' + repr(MODEL_REVISIONS["syvai/qwen3.8-27b-3090-fast-variant"]) + ','),
        ("fetch_dflash2.py", 'snapshot_download(REPO, local_dir=D,',
         'snapshot_download(REPO, revision=' + repr(MODEL_REVISIONS["syvai/Qwen3.8-27B-DFlash2-W4A16"]) + ', local_dir=D,'),
    ]:
        code = replace_once((root / "prepare" / filename).read_text(), pattern, replacement)
        code = f"import sys\nsys.path.insert(0, {str(root / 'prepare')!r})\n" + code
        ast.parse(code)
        outputs[filename] = code
    prep = (root / "docker/prepare.sh").read_text().replace("/app", str(root))
    prep = replace_once(prep, 'hf download "$HF_REPO" --local-dir "$BASE"',
                        'hf download "$HF_REPO" --revision ' + MODEL_REVISIONS["dbirks/Qwen3.8-27B-W4A16-AutoRound"] + ' --local-dir "$BASE"')
    for name in ["fetch_fast_variant.py", "fetch_dflash2.py"]:
        prep = replace_once(prep, f"python prepare/{name}", f"python .setup/{name}")
    # Disallow ambient model overrides; these revisions name these repositories.
    prep = replace_once(prep, "set -e\n", "set -e\nunset HF_REPO BASE_MODEL_DIR MODEL\nexport FAST_VARIANT=1 DFLASH2=1 HARDEN_TEMPLATES=1 TRANSLATE_EFFORT=1 LSA=0\n")
    outputs["prepare-native.sh"] = prep
    outputs["model-revisions.json"] = json.dumps({"upstream": UPSTREAM, "models": MODEL_REVISIONS}, indent=2) + "\n"
    # Never replace different generated scripts on an interrupted installation.
    for name, content in outputs.items():
        path = setup / name
        if path.exists() and path.read_text() != content:
            raise ValueError(f"Existing adapter differs: {path}; preserve and inspect it")
    for name, content in outputs.items():
        (setup / name).write_text(content)
    return setup / "prepare-native.sh"


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python3 prepare-native.py /absolute/path/to/fresh-hyperqwen-checkout")
    print("Generated (not executed):", generate(sys.argv[1]))
