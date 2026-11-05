"""Offline checks only: temporary fake sources and a loopback simulated API."""
import contextlib
import importlib.util
import json
import os
import pathlib
import subprocess
import sys
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from unittest.mock import patch

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("prepare_native", ROOT / "reproduce/prepare-native.py")
prepare = importlib.util.module_from_spec(spec)
spec.loader.exec_module(prepare)


class PreparationTests(unittest.TestCase):
    def test_pins_native_adapters_and_refuses_overwrite_or_wrong_source(self):
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            (root / "prepare").mkdir()
            (root / "docker").mkdir()
            # Minimal invented source shapes; no upstream implementation is copied.
            fast = root / "prepare/fetch_fast_variant.py"
            fast.write_text('snapshot_download("syvai/qwen3.8-27b-3090-fast-variant", allow_patterns=[])\n')
            (root / "prepare/fetch_dflash2.py").write_text('snapshot_download(REPO, local_dir=D, allow_patterns=[])\n')
            (root / "docker/prepare.sh").write_text('#!/bin/bash\nset -e\ncd /app\nhf download "$HF_REPO" --local-dir "$BASE"\npython prepare/fetch_fast_variant.py\npython prepare/fetch_dflash2.py\n')
            def git(args, **kwargs):
                return prepare.UPSTREAM if "rev-parse" in args else ""
            with patch.object(prepare.subprocess, "check_output", side_effect=git):
                script = prepare.generate(root)
                first = script.read_text()
                subprocess.run(["bash", "-n", str(script)], check=True)
                combined = "".join(p.read_text() for p in (root / ".setup").iterdir() if p.suffix != ".json")
                for revision in prepare.MODEL_REVISIONS.values():
                    self.assertIn(revision, combined)
                self.assertNotIn("/app", first)
                self.assertIn("unset HF_REPO BASE_MODEL_DIR MODEL", first)
                self.assertEqual(prepare.generate(root).read_text(), first)
                script.write_text("keep this evidence\n")
                with self.assertRaisesRegex(ValueError, "Existing adapter differs"):
                    prepare.generate(root)
                self.assertEqual(script.read_text(), "keep this evidence\n")
                fast.write_text("changed_upstream()\n")
                with self.assertRaisesRegex(ValueError, "Expected one source pattern"):
                    prepare.generate(root)
            with patch.object(prepare.subprocess, "check_output", return_value="wrong-commit"):
                with self.assertRaisesRegex(ValueError, "only the documented"):
                    prepare.generate(root)
            with patch.object(prepare.subprocess, "check_output", side_effect=[prepare.UPSTREAM, "local diff"]):
                with self.assertRaisesRegex(ValueError, "local edits"):
                    prepare.generate(root)


@contextlib.contextmanager
def fake_api(mode="success"):
    requests = []

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def do_GET(self):
            self.send_response(200)
            self.end_headers()
            self.wfile.write(json.dumps({"data": [{"id": "qwen3.8-27b", "max_model_len": 65536}]}).encode())

        def do_POST(self):
            body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
            self.send_response(200)
            self.end_headers()
            if self.path == "/tokenize":
                self.wfile.write(b'{"count": 4096}')
                return
            requests.append(body)
            cached = 0 if len(requests) == 1 else 4000
            usage = {"prompt_tokens": 4096, "completion_tokens": 16, "prompt_tokens_details": {"cached_tokens": cached}}
            if mode == "missing-cache":
                del usage["prompt_tokens_details"]
            if mode == "wrong-tokens":
                usage["prompt_tokens"] = 4097
            events = [
                {"choices": [{"delta": {"content": "Synthetic response — "}}]},
                {"choices": [{"delta": {"content": "review separately."}, "finish_reason": "length" if mode == "capped" else "stop"}]},
                {"choices": [], "usage": usage},
            ]
            if mode != "missing-timing":
                events[-1]["metrics"] = {"time_to_first_token_ms": 125 if len(requests) == 1 else 10, "generation_time_ms": 500}
            for event in events:
                self.wfile.write(("data: " + json.dumps(event) + "\n\n").encode())
                self.wfile.flush()
            self.wfile.write(b"data: [DONE]\n\n")

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    worker = threading.Thread(target=lambda: server.serve_forever(poll_interval=0.01), daemon=True)
    worker.start()
    try:
        yield f"http://127.0.0.1:{server.server_port}", requests
    finally:
        server.shutdown()
        server.server_close()
        worker.join()


class ProbeTests(unittest.TestCase):
    def invoke(self, base, out):
        return subprocess.run([sys.executable, str(ROOT / "reproduce/probe.py"), "--base", base, "--out", str(out)],
                              env={**os.environ, "HQ_API_KEY": "synthetic-test-secret"}, capture_output=True, text=True, timeout=15)

    def test_serial_repeat_preserves_requests_and_separates_metrics(self):
        with tempfile.TemporaryDirectory() as directory, fake_api() as (base, requests):
            out = pathlib.Path(directory) / "run"
            result = self.invoke(base, out)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(len(requests), 2)
            self.assertEqual(requests[0], requests[1])
            rows = json.loads((out / "summary.json").read_text())["results"]
            self.assertEqual([r["cachedTokens"] for r in rows], [0, 4000])
            self.assertEqual([r["prefillSeconds"] for r in rows], [.125, .01])
            self.assertEqual(rows[0]["decodeTokensPerSecond"], 30)
            self.assertIn("Synthetic response —", (out / "cold-attempt-answer.txt").read_text())
            for path in out.iterdir():
                self.assertNotIn("synthetic-test-secret", path.read_text())
            self.assertNotEqual(self.invoke(base, out).returncode, 0)
            self.assertEqual(len(requests), 2, "Existing evidence must not be overwritten or replayed")

    def test_failed_measurements_are_retained_without_inventing_success(self):
        for mode, detail in [("missing-timing", "Missing server timing"), ("missing-cache", "Cold isolation"),
                             ("capped", "capped/empty"), ("wrong-tokens", "counts disagree")]:
            with self.subTest(mode=mode), tempfile.TemporaryDirectory() as directory, fake_api(mode) as (base, requests):
                out = pathlib.Path(directory) / "run"
                result = self.invoke(base, out)
                self.assertNotEqual(result.returncode, 0)
                self.assertEqual(len(requests), 1)
                failure = json.loads((out / "failure.json").read_text())
                self.assertIn(detail, failure["detail"])
                self.assertTrue((out / "cold-attempt-events.jsonl").is_file())
                row = json.loads((out / "summary.json").read_text())["results"][0]
                if mode == "missing-timing":
                    self.assertIsNone(row["prefillSeconds"])
                    self.assertIsNotNone(row["firstAnswerSeconds"])
                if mode == "missing-cache":
                    self.assertIsNone(row["cachedTokens"])
                if mode == "capped":
                    self.assertEqual(row["finishReason"], "length")


if __name__ == "__main__":
    unittest.main()
