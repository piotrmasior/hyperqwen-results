# Install HyperQwen on a remote server

A general runbook for a human or an agent with SSH access to a Linux GPU server. It uses a native virtual environment, a pinned HyperQwen checkout, explicit model revisions, and a loopback API. All hostnames and accounts are placeholders. The commands below run on the remote server unless a block says WORKSTATION.

This route recreates the reference serving configuration. It is not a fresh installation test on every supported GPU, and the two-request smoke test is not the published 149-request benchmark. The installation recipe was checked against the pinned source; the adapters and probe were tested without changing a live GPU server.

## 01 · Connect and unpack the kit

WORKSTATION: download the reproduction kit from this page, replace the remote account/hostname below, and copy it to the target. Existing SSH authentication must already work. Use the owner's established host-key verification procedure on first connection.

```bash
scp reproduction-kit.tar.gz REMOTE_USER@REMOTE_HOST:~/
ssh REMOTE_USER@REMOTE_HOST
```

REMOTE: use Bash and extract the kit into its own directory. The kit contains preparation/probe scripts, two profiles, this runbook, and the linked methodology/snapshot notes; it contains no model weights.

```bash
bash
set -euo pipefail
mkdir -p "$HOME/hyperqwen-reproduce"
tar -xzf "$HOME/reproduction-kit.tar.gz" -C "$HOME/hyperqwen-reproduce"
export HQ_KIT="$HOME/hyperqwen-reproduce"
export HQ_ROOT="$HOME/hyperqwen"
export HQ_PIN=6ab9bd05cb84b538a6595d634f3e337ac8a80856
```

Checkpoint: the remote account can read `$HQ_KIT/reproduce/prepare-native.py`. Choose an unused installation directory. The native path adapter requires a path without spaces or shell metacharacters. After reconnecting, restore these three variables before continuing.

## 02 · Inspect compatibility and available capacity

REMOTE: collect the target's own facts. Do not substitute someone else's hardware description or assume their context capacity will fit.

```bash
cat /etc/os-release
uname -m
uname -r
lscpu
free -h
df -h "$HOME"
python3 --version
nvidia-smi --query-gpu=name,driver_version,memory.total,memory.used --format=csv
nvidia-smi
```

This recipe targets Ubuntu on x86-64 with an NVIDIA CUDA GPU. Upstream's documented native starting point is a 24 GB Ampere-or-newer card. Smaller cards, other architectures and multi-GPU layouts need a separately validated profile; reducing context cannot make weights fit if the model itself is too large. Record free RAM and disk space before downloading. Upstream advises a different weight-loading strategy below roughly 16 GB of free host RAM; resolve that before using these reference profiles. Allow room for weights, download caches, the Python environment and compilation; reserve roughly 80 GB of free disk as a planning allowance, not a measured minimum.

The pinned runtime uses CUDA 13. NVIDIA documents R580-or-newer drivers for CUDA 13 minor-version compatibility; the selected GPU and JIT features must also be supported. A successful `nvidia-smi` alone does not prove PyTorch can run this stack. Use a supported Python interpreter with its matching development headers; Python 3.12 and 3.14 are documented by this upstream revision. If the target differs, resolve that before continuing.

Checkpoint: an idle, compatible GPU is available for startup and measurements. Record existing GPU processes; do not stop another workload just to make the test pass.

Sources: [upstream native installation](https://github.com/syv-ai/HyperQwen/blob/6ab9bd05cb84b538a6595d634f3e337ac8a80856/docs/install.md), [NVIDIA CUDA compatibility](https://docs.nvidia.com/deploy/cuda-compatibility/minor-version-compatibility.html).

## 03 · Install the host prerequisites

REMOTE, Ubuntu: install the build tools and the headers matching the selected Python. These commands use the distribution's `python3`; if you selected a different version, install that version's `-dev` and `-venv` packages and use it consistently.

```bash
sudo apt-get update
sudo apt-get install -y --no-install-recommends \
  git curl ca-certificates build-essential patch cmake pkg-config \
  python3-dev python3-venv util-linux
```

If the driver is already compatible, keep it. If it is missing or incompatible, Ubuntu provides the following discovery and installation path. Check the proposed driver supports both the GPU and CUDA 13; automatic hardware selection alone is not a CUDA compatibility check. Schedule any required reboot with the machine owner, reconnect, and repeat step 02.

```bash
# Only when driver installation is needed:
sudo apt-get install -y ubuntu-drivers-common
ubuntu-drivers list --gpgpu
sudo ubuntu-drivers install --gpgpu
```

If `nvidia-smi` is absent, install the `nvidia-utils` package matching the actual installed driver branch and its server/non-server variant. Do not copy a driver branch from a benchmark machine. Follow [Ubuntu's driver instructions](https://ubuntu.com/server/docs/how-to/graphics/install-nvidia-drivers/) for package selection, Secure Boot and reboot requirements.

Checkpoint: `nvidia-smi` works after driver setup, the compiler is available, and Python development headers match the interpreter.

## 04 · Pin the serving source

REMOTE: clone into the unused directory and detach at the complete recorded commit. Do not run an unpinned `main` checkout and label it the reference build.

```bash
test ! -e "$HQ_ROOT"
git clone https://github.com/syv-ai/HyperQwen.git "$HQ_ROOT"
git -C "$HQ_ROOT" checkout --detach "$HQ_PIN"
test "$(git -C "$HQ_ROOT" rev-parse HEAD)" = "$HQ_PIN"
cd "$HQ_ROOT"
mkdir -p .setup models
git rev-parse HEAD > .setup/upstream-revision.txt
```

Checkpoint: the full SHA matches. For a later release, use a new installation directory, inspect that release's requirements and launchers, and adapt the recipe explicitly. The bundled preparation adapter intentionally refuses other revisions.

## 05 · Install the pinned Python stack

REMOTE, as the normal login user: create the environment. The optional `pyarrow==20` requirement is omitted because it is for the upstream parquet quality battery and has no Python 3.14 wheel. That omission means this recipe does not install that battery's dependencies.

```bash
cd "$HQ_ROOT"
python3 -m venv venv
export PATH="$HQ_ROOT/venv/bin:$PATH"
export MAX_JOBS=2
export CMAKE_BUILD_PARALLEL_LEVEL=2
export OMP_NUM_THREADS=2
python -m pip install --upgrade pip
sed '/^pyarrow==/d' docker/requirements.txt > .setup/requirements-native.txt
python -m pip install --no-cache-dir \
  -r .setup/requirements-native.txt \
  --extra-index-url https://flashinfer.ai/whl/ \
  flashinfer-cubin==0.7.0.post1 2>&1 | tee .setup/dependencies.log
python -m pip check
```

Keep the CUDA compiler/runtime pins from `docker/requirements.txt`; independently upgrading nvcc or FlashInfer can break JIT compilation. These direct requirements are pinned, but this is not a hash-locked copy of every transitive package and build dependency. Preserve the resolved package inventory in step 13. Do not install or upgrade vLLM after applying the patches in step 07: reinstalling it can replace patched files.

Checkpoint: dependency installation succeeds with no unresolved package conflicts. Record any change required by the target platform as a different software configuration.

Source: [pinned runtime requirements](https://github.com/syv-ai/HyperQwen/blob/6ab9bd05cb84b538a6595d634f3e337ac8a80856/docker/requirements.txt).

## 06 · Verify CUDA and native linker paths

REMOTE: explicitly select the virtual environment's CUDA 13 toolchain. Some wheel layouts lack the linker aliases used by the FP8 attention JIT. The following creates only missing aliases inside this environment and refuses unresolved paths.

```bash
cd "$HQ_ROOT"
export PATH="$HQ_ROOT/venv/bin:$PATH"
python - <<'PY'
from pathlib import Path
import sysconfig
cuda = Path(sysconfig.get_paths()['purelib']) / 'nvidia/cu13'
runtime = cuda / 'lib/libcudart.so.13'
assert runtime.is_file(), f'Expected CUDA 13 runtime missing: {runtime}'
for link, target in [(cuda / 'lib64', 'lib'), (cuda / 'lib/libcudart.so', 'libcudart.so.13')]:
    if not link.exists() and not link.is_symlink():
        link.symlink_to(target)
    assert link.exists(), f'Broken linker path: {link}'
assert (cuda / 'lib64/libcudart.so').is_file()
PY
export HQ_CUDA_HOME="$(python -c 'import sysconfig; print(sysconfig.get_paths()["purelib"] + "/nvidia/cu13")')"
export CUDA_HOME="$HQ_CUDA_HOME"
"$CUDA_HOME/bin/nvcc" --version
python - <<'PY'
import torch
assert torch.cuda.is_available(), 'CUDA unavailable to PyTorch'
x = torch.ones(8, device='cuda')
assert x.sum().item() == 8
print('torch:', torch.__version__, 'CUDA runtime:', torch.version.cuda)
print('GPU:', torch.cuda.get_device_name(0))
print('compute capability:', torch.cuda.get_device_capability(0))
print('compiled architectures:', torch.cuda.get_arch_list())
PY
```

Checkpoint: nvcc reports the pinned 13.0 compiler, and an actual tensor operation succeeds. This tests the framework layer; the later serving probe still needs to validate the quantized model and attention backend.

## 07 · Apply patches and build the pinned grammar runtime

REMOTE: apply the patch series once to this fresh vLLM installation, then build the xgrammar revision named by upstream. A failed patch is a failed installation step, not a warning to ignore.

```bash
cd "$HQ_ROOT"
HQ_VLLM_DIR="$(venv/bin/python -c 'import importlib.util; print(next(iter(importlib.util.find_spec("vllm").submodule_search_locations)))')"
bash patches/apply.sh "$HQ_VLLM_DIR" 2>&1 | tee .setup/patches.log
bash xgrammar/install.sh 2>&1 | tee .setup/xgrammar.log
```

Checkpoint: both commands succeed. The main patch series is not blindly rerunnable. If interrupted or partially applied, retain the error log and reconstruct a clean environment before replaying the whole series. Do not use a success marker as a substitute for the later verifier. Optional KVarN, pth-flash-attn and FA2 extensions are outside this reference path.

Sources: [patch application contract](https://github.com/syv-ai/HyperQwen/blob/6ab9bd05cb84b538a6595d634f3e337ac8a80856/patches/apply.sh), [xgrammar pin](https://github.com/syv-ai/HyperQwen/blob/6ab9bd05cb84b538a6595d634f3e337ac8a80856/xgrammar/PIN).

## 08 · Prepare explicitly pinned model files

REMOTE: generate native copies of the pinned preparation scripts, inspect them, and execute the generated shell script. Tracked upstream files stay unchanged. The helper pins the base, fast variant and drafter downloads instead of relying on mutable model `main` refs.

```bash
cd "$HQ_ROOT"
python3 "$HQ_KIT/reproduce/prepare-native.py" "$HQ_ROOT"
cat .setup/model-revisions.json
bash -n .setup/prepare-native.sh
# Inspect the generated script and Python adapters before running them.
export HF_XET_HIGH_PERFORMANCE=1
bash .setup/prepare-native.sh 2>&1 | tee .setup/prepare.log
test -s models/Qwen3.8-27B-DFlash2-W4A16/model.safetensors
bash verify.sh --no-server 2>&1 | tee .setup/verify-offline.log
```

Checkpoint: model preparation and offline verification succeed. Inspect individual verifier warnings: the API is not running yet, and the upstream service name may differ from the service created below. Missing weights, missing patches and incompatible runtime versions are not acceptable warnings. The preparation helper uses the three observed revision refs included in this kit; it does not prove bit-for-bit identity with historical transformed weights, which were not fully hashed.

The upstream preparer uses a lock and validates retained files, so its completed stages can be reused after an interruption. Never let two independent model-preparation processes mutate the same directory. Do not run the generated DFlash2 adapter with `--bf16`; this kit pins the W4A16 drafter.

## 09 · Start the baseline in the foreground

REMOTE: begin with the reference 64k profile. It explicitly binds the API to loopback. Confirm the chosen port is unused before starting. If capacity is insufficient, lower `MAX_LEN` or `MAX_SEQS` in a separately named profile and record the change; the result is no longer the exact reference configuration.

```bash
cd "$HQ_ROOT"
ss -ltnp 'sport = :18020'
cp "$HQ_KIT/reproduce/profiles/dflash2-64k.env" .setup/server.env
printf '\nCUDA_HOME=%s\n' "$HQ_CUDA_HOME" >> .setup/server.env
(
  set -a
  source .setup/server.env
  set +a
  bash single-user/start_qwen.sh
) 2>&1 | tee .setup/first-start.log
```

This command occupies the terminal while the server runs. Kernel compilation and graph capture can take several minutes. From a second SSH terminal, test readiness:

```bash
curl --fail --max-time 10 http://127.0.0.1:18020/health
curl --fail --max-time 10 http://127.0.0.1:18020/v1/models
```

Checkpoint: the API advertises the expected model and a 65,536-token context; inspect the startup log for the actual speculation, cache dtype, backend and allocation. A running process is not a completed readiness check. Stop the foreground server with Ctrl-C before installing the persistent service.

## 10 · Keep the service running after logout

REMOTE: create a dedicated user service. Do not overwrite an existing service with the same name; use a distinct name if needed. The API stays bound to loopback through the selected environment file.

```bash
mkdir -p "$HOME/.config/systemd/user"
test ! -e "$HOME/.config/systemd/user/hyperqwen-reference.service"
cat > "$HOME/.config/systemd/user/hyperqwen-reference.service" <<EOF
[Unit]
Description=HyperQwen reference serving profile
After=network-online.target
StartLimitIntervalSec=900
StartLimitBurst=3

[Service]
Type=simple
WorkingDirectory=$HQ_ROOT
EnvironmentFile=$HQ_ROOT/.setup/server.env
ExecStart=/bin/bash $HQ_ROOT/single-user/start_qwen.sh
Restart=on-failure
RestartSec=20
TimeoutStopSec=90
KillMode=control-group

[Install]
WantedBy=default.target
EOF
sudo loginctl enable-linger "$(id -un)"
systemctl --user daemon-reload
systemctl --user enable --now hyperqwen-reference.service
journalctl --user -u hyperqwen-reference.service -n 80 --no-pager
```

Checkpoint: repeat the health and model checks from step 09. Inspect `systemctl --user show hyperqwen-reference -p ActiveState -p SubState -p NRestarts` and verify there is no restart loop. After reconnecting, the API should still answer. A reboot test can be scheduled separately if boot persistence needs verification.

## 11 · Verify generation and inspect timing

REMOTE: with no other inference clients active, run the included synthetic probe. It sends one isolated request and one exact repeat, saves streams and answers, and reports server prefill, decode speed, client time, cached tokens and API termination separately.

```bash
export HQ_RUN="$HOME/hyperqwen-runs/smoke-$(date -u +%Y%m%dT%H%M%SZ)"
python3 "$HQ_KIT/reproduce/probe.py" --out "$HQ_RUN"
cat "$HQ_RUN/summary.json"
```

Checkpoint: both requests return nonempty final content and `stop`, and server timing metrics are present. Inspect the answer itself; the probe does not grade correctness. A repeat is an attempt to reuse cache, not a guaranteed cache hit: read its actual `cachedTokens`. A length-capped response and any failure are preserved. The first probe may include remaining warmup work, so these timings are an installation check, not publication-grade benchmark results.

Optional WORKSTATION access uses a generic SSH forward. Keep this terminal open, then access the same local API port from a different workstation terminal. This is ordinary API transport, not an agent-specific integration.

```bash
ssh -N -o ExitOnForwardFailure=yes \
  -L 18020:127.0.0.1:18020 REMOTE_USER@REMOTE_HOST
```

## 12 · Evaluate the long-context profile

REMOTE: switch profiles only with the service idle. Keep the baseline environment for rollback. Recompute `HQ_CUDA_HOME` if this is a new shell. A 150k configured window is an attempted capacity, not a guarantee for every GPU.

```bash
export HQ_CUDA_HOME="$("$HQ_ROOT/venv/bin/python" -c 'import sysconfig; print(sysconfig.get_paths()["purelib"] + "/nvidia/cu13")')"
test ! -e "$HQ_ROOT/.setup/baseline.env"
systemctl --user stop hyperqwen-reference.service
cp "$HQ_ROOT/.setup/server.env" "$HQ_ROOT/.setup/baseline.env"
cp "$HQ_KIT/reproduce/profiles/mtp-150k.env" "$HQ_ROOT/.setup/server.env"
printf '\nCUDA_HOME=%s\n' "$HQ_CUDA_HOME" >> "$HQ_ROOT/.setup/server.env"
systemctl --user start hyperqwen-reference.service
journalctl --user -u hyperqwen-reference.service -n 100 --no-pager
curl --fail --max-time 10 http://127.0.0.1:18020/v1/models
```

The backup check refuses to overwrite an earlier baseline; if repeating this step, inspect and preserve that backup first. Wait for actual readiness before interpreting an early connection refusal. Confirm MTP with three drafts, FP8 KV, FlashInfer and the requested window from the log. Re-run the small probe into a new output directory. Only then increase input in steps, checking actual tokenized input plus the output allowance against the advertised context. A 120k input plus 30k output reservation fills a 150k window; a 128k input plus 30k does not fit. Low reasoning and ordinary EOS handling were useful investigation settings, not guarantees of correctness.

To restore the recorded baseline after this experiment:

```bash
systemctl --user stop hyperqwen-reference.service
cp "$HQ_ROOT/.setup/baseline.env" "$HQ_ROOT/.setup/server.env"
systemctl --user reset-failed hyperqwen-reference.service
systemctl --user start hyperqwen-reference.service
```

Checkpoint: restored context and an actual completion match the intended baseline. Run a new experiment in a fresh output directory; do not overwrite earlier results.

## 13 · Record a comparable experiment

REMOTE: capture software provenance and configuration. Keep machine logs locally and curate them before publication. Package inventories can contain local paths or direct download URLs.

```bash
cd "$HQ_ROOT"
git rev-parse HEAD > .setup/upstream-revision.txt
venv/bin/python -m pip freeze > .setup/installed-packages.txt
sha256sum .setup/server.env .setup/requirements-native.txt \
  models/Qwen3.8-27B-W4A16-AutoRound-fast/config.json \
  models/Qwen3.8-27B-W4A16-AutoRound-fast/tokenizer_config.json \
  models/Qwen3.8-27B-W4A16-AutoRound-fast/chat_template.jinja \
  > .setup/config-hashes.txt
```

For stronger future reproducibility, also hash the transformed model files and patched runtime source or preserve a reproducible environment image. Those operations can take time and are not implied by recording only a package version or model cache ref.

- Warm the loaded model before measuring. Keep startup and prompt-preparation time separate.
- Run one request at a time. Reject contaminated runs with concurrent requests or unaccounted restarts; retain the evidence.
- Freeze messages, templates, tool schemas, sampling, output allowance and input-token fingerprints. Verify actual cached-token counts rather than inferring a cache hit from shared text.
- Record prefill, generation rate, first final text, total latency, output/reasoning length, finish reason and preemptions separately.
- Repeat cold timing observations and report their sample counts. Do not turn four task examples into a broad accuracy or p95 claim.
- Review required deliverables and execute appropriate acceptance checks in an isolated test environment. API `stop` does not establish semantic completion.
- Use the published snapshot schema only after curating the data. Different hardware or method should be a separate condition, not an attributed upstream speedup.

The complete historical prompts, conversation trajectories and measured harness are not included in this kit. Therefore this guide reproduces installation and reference profiles, while the probe reproduces only its own two synthetic requests. It cannot recreate the exact 149 historical requests or claim a matched release comparison. Read the [measurement method](methodology.md) and [snapshot instructions](adding-results.md) before submitting new results.

## 14 · Recover at the failing layer

- SSH fails: resolve account, key and host verification before attempting installation commands.
- PyTorch cannot use CUDA: inspect driver compatibility and the selected interpreter; do not proceed to model timing.
- Patch application fails: preserve the log and restore a clean compatible environment; do not skip the patch.
- FP8 JIT cannot find `-lcudart`: verify the environment-local linker paths and explicit CUDA_HOME from step 06. A newer nvcc is not automatically compatible with older runtime headers.
- DFlash2 weights are absent: the upstream preparation stage treats that download as optional. The explicit file check in step 08 is mandatory for the DFlash2 profile.
- Startup runs out of memory: retain the failure, lower capacity/concurrency in a new profile, and record the difference. Do not assume 150k fits because another machine served it.
- A disabled-MTP diagnostic fails on speculative metrics: set `REQ_METRICS=0` and use `EXTRA_ARGS="--attention-backend=FLASHINFER --enable-per-request-metrics --enable-force-include-usage"`. Revalidate all effective settings; this is a new configuration, not a transparent fix.
- An answer ends early with `stop`: inspect EOS and deliverable completeness. Do not globally ignore EOS as a workaround; the recorded diagnostic emitted new message markers after EOS.

## Container alternative

The upstream default installation path uses Docker. If you prefer it, follow the pinned [container guide](https://github.com/syv-ai/HyperQwen/blob/6ab9bd05cb84b538a6595d634f3e337ac8a80856/docs/docker.md), [Docker's Ubuntu installation](https://docs.docker.com/engine/install/ubuntu/), and [NVIDIA Container Toolkit setup](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html). Verify GPU access inside the container before model startup.

Record an immutable image digest and model revisions. A mutable image tag plus a pinned source checkout is not a pinned runtime. The native helper in this kit does not modify the container workflow, and native-versus-container results should identify that difference. The same readiness, serial measurement, context-budget and correctness checks still apply.

## Agent handoff

An installing agent should leave: the actual upstream revision; target hardware/software facts; environment and profile paths; model refs and hashes; build/startup failures and recovery steps; service status and listening address; readiness and real-completion evidence; smoke-test output directory; and the exact command for restoring the prior profile. Keep credentials out of reports. Mark any skipped or unverified checkpoint explicitly. Do not report a fresh GPU installation as tested merely because the guide or scripts passed offline checks.
