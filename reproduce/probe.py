#!/usr/bin/env python3
"""Two serial synthetic API probes; no server mutations or generated-code execution."""
import argparse
import hashlib
import json
import os
import pathlib
import time
import urllib.request
import uuid


def request(base, path, body=None):
    headers = {"Content-Type": "application/json"}
    if os.environ.get("HQ_API_KEY"):
        headers["Authorization"] = "Bearer " + os.environ["HQ_API_KEY"]
    return urllib.request.urlopen(urllib.request.Request(base.rstrip("/") + path,
        data=None if body is None else json.dumps(body).encode(), headers=headers), timeout=900)


def collect(base, payload, out, label):
    began = time.perf_counter()
    usage = metrics = finish = first = None
    answer = ""
    with (out / f"{label}-events.jsonl").open("w") as archive:
        with request(base, "/v1/chat/completions", payload) as response:
            for line in response:
                if not line.startswith(b"data:"):
                    continue
                data = line[5:].strip()
                if data == b"[DONE]":
                    break
                event = json.loads(data)
                archive.write(json.dumps(event) + "\n")
                archive.flush()
                usage = event.get("usage") or usage
                metrics = event.get("metrics") or metrics
                choice = (event.get("choices") or [{}])[0]
                finish = choice.get("finish_reason") or finish
                content = choice.get("delta", {}).get("content")
                if content:
                    if first is None:
                        first = time.perf_counter() - began
                    answer += content
    wall = time.perf_counter() - began
    (out / f"{label}-answer.txt").write_text(answer)
    if not usage or not finish:
        raise ValueError("Incomplete stream or missing usage; raw events retained")
    metrics = metrics or {}
    # Do not substitute client TTFT for missing server prefill metrics.
    prefill_ms = metrics.get("time_to_first_token_ms")
    decode_ms = metrics.get("generation_time_ms")
    output = usage["completion_tokens"]
    return {"condition": label, "inputTokens": usage["prompt_tokens"],
            "cachedTokens": usage.get("prompt_tokens_details", {}).get("cached_tokens"),
            "outputTokens": output, "finishReason": finish, "hasAnswer": bool(answer.strip()),
            "firstAnswerSeconds": first, "wallSeconds": wall,
            "prefillSeconds": None if prefill_ms is None else prefill_ms / 1000,
            "decodeTokensPerSecond": None if not decode_ms else (output - 1) / (decode_ms / 1000),
            "serverMetrics": metrics,
            "answerSha256": hashlib.sha256(answer.encode()).hexdigest()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", default="http://127.0.0.1:18020")
    parser.add_argument("--model", default="qwen3.8-27b")
    parser.add_argument("--out", required=True, type=pathlib.Path)
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=False)
    rows = []
    try:
        with request(args.base, "/v1/models") as response:
            models = json.load(response)
        selected = next(m for m in models["data"] if m["id"] == args.model)
        # Enough shared prefix to exercise cache blocks; never a context-capacity test.
        notes = "\n".join(f"NOTE-{i:03d}: Synthetic catalog snapshot {i} is read-only. It cannot charge a provider, change balances, or acknowledge ingestion events." for i in range(100))
        payload = {"model": args.model, "temperature": 0, "seed": 42, "max_tokens": 512,
                   "stream": True, "stream_options": {"include_usage": True},
                   "chat_template_kwargs": {"enable_thinking": False}, "cache_salt": str(uuid.uuid4()),
                   "messages": [{"role": "system", "content": "Use only the supplied synthetic records. Do not execute code."},
                                {"role": "user", "content": notes + "\nExplain in 100 words why these records cannot establish exactly-once payment processing. Do not invent additional records."}]}
        with request(args.base, "/tokenize", {k: payload[k] for k in ["model", "messages", "chat_template_kwargs"]}) as response:
            tokens = json.load(response)
        if tokens["count"] + payload["max_tokens"] > selected["max_model_len"]:
            raise ValueError("Probe does not fit the advertised context")
        (args.out / "request.json").write_text(json.dumps(payload, indent=2) + "\n")
        for label in ["cold-attempt", "exact-repeat"]:
            row = collect(args.base, payload, args.out, label)
            rows.append(row)
            (args.out / "summary.json").write_text(json.dumps({"purpose": "smoke-test-v1, not the published benchmark suite", "results": rows}, indent=2) + "\n")
            print(json.dumps(row), flush=True)
            if row["inputTokens"] != tokens["count"]:
                raise ValueError("Tokenizer and generation input counts disagree")
            if label == "cold-attempt" and row["cachedTokens"] != 0:
                raise ValueError("Cold isolation not demonstrated; do not label this a cold timing")
            if row["prefillSeconds"] is None:
                raise ValueError("Missing server timing metrics; check REQ_METRICS")
            if not row["hasAnswer"] or row["finishReason"] != "stop":
                raise ValueError("Completion smoke check failed; capped/empty response retained")
        print("Completed two probes. Review answer correctness separately; inspect actual cachedTokens on the repeat.")
    except Exception as error:
        (args.out / "failure.json").write_text(json.dumps({"error": type(error).__name__, "detail": str(error), "completedRequests": len(rows)}, indent=2) + "\n")
        raise


if __name__ == "__main__":
    main()
