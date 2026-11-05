import {
  cases,
  caseLabels,
  experimentLabels,
  median,
  compareSnapshots,
  toCsv,
} from "./data.ts";
import type { Snapshot, Measurement } from "./data.ts";

const $ = <T extends HTMLElement = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)!;
const esc = (value: any) =>
  String(value ?? "—").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const fmt = (n: number | null | undefined, digits = 2) =>
  n == null
    ? "—"
    : n.toLocaleString("en-US", {
        maximumFractionDigits: digits,
        minimumFractionDigits: digits,
      });
const num = (n: number | null | undefined) => fmt(n, 0);
let snapshots: Snapshot[] = [];
let current: Snapshot;
let currentMetric = "prefillSeconds";
let cap = 30000,
  page = 0;
let selectedCase = "03-architecture",
  selectedTurn = 6;
let filtered: Measurement[] = [];
const pageSize = 15;
const initialId = "2026-11-05-6ab9bd0";

function table(headers: string[], rows: string[][]) {
  return `<table><thead><tr>${headers.map((h) => `<th scope="col">${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}
function legend(items: [string, string][]) {
  return `<div class="legend">${items.map(([label, color]) => `<span><i style="--swatch:${color}"></i>${esc(label)}</span>`).join("")}</div>`;
}
function empty(text: string) {
  return `<div class="empty-state">${esc(text)}</div>`;
}
function setPressed(selector: string, key: string, value: string) {
  document
    .querySelectorAll<HTMLButtonElement>(selector)
    .forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset[key] === value)),
    );
}
function renderStats() {
  const rows = current.measurements;
  const long = rows.filter(
    (r) => r.experiment === "long-context" && r.cacheMode === "cold",
  );
  const maxInput = Math.max(...rows.map((r) => r.inputTokens));
  const target = long.find((r) => r.caseId === "04-long-audit");
  $("#stats").innerHTML = [
    [
      num(rows.length),
      "measured requests",
      "Seven experiments in the initial study",
    ],
    [
      num(maxInput),
      "largest measured input",
      "Tokens, including the chat template",
    ],
    [
      target ? `${fmt(target.prefillSeconds, 1)} <small>s</small>` : "—",
      "cold prefill at largest non-thinking input",
      "Server scheduling → first generated token",
    ],
    [
      num(new Set(rows.map((r) => r.profile)).size),
      "serving configurations",
      "Loaded model · serial requests",
    ],
  ]
    .map(
      ([value, label, note]) =>
        `<div class="stat"><strong>${value}</strong><span>${esc(label)}</span><span>${esc(note)}</span></div>`,
    )
    .join("");
}
function renderScaling() {
  const rows = current.measurements.filter((r) =>
    ["baseline", "long-context"].includes(r.experiment),
  );
  if (!rows.length) {
    $("#scaling-chart").innerHTML = empty(
      "No baseline/context-scaling measurements in this snapshot. See the request ledger.",
    );
    $("#scaling-table").innerHTML = "";
    $("#scaling-note").textContent = "";
    return;
  }
  const series = [
    {
      profile: "dflash2-64k",
      mode: "cold",
      label: "DFlash2 64k · cold",
      color: "#325ce8",
    },
    {
      profile: "mtp-150k",
      mode: "cold",
      label: "MTP 150k · cold",
      color: "#172b42",
    },
    {
      profile: "dflash2-64k",
      mode: "exact-repeat",
      label: "DFlash2 · exact repeat",
      color: "#b37318",
    },
    {
      profile: "mtp-150k",
      mode: "exact-repeat",
      label: "MTP · exact repeat",
      color: "#207e77",
    },
  ];
  const key = currentMetric as keyof Measurement;
  const maximum = Math.max(...rows.map((r) => Number(r[key])));
  const ymax =
    Math.ceil(maximum / (currentMetric === "decodeTokensPerSecond" ? 40 : 20)) *
    (currentMetric === "decodeTokensPerSecond" ? 40 : 20);
  const xmax = Math.max(150000, ...rows.map((r) => r.inputTokens));
  const x = (n: number) => 62 + (n / xmax) * 925,
    y = (n: number) => 300 - (n / ymax) * 235;
  const unit =
    currentMetric === "decodeTokensPerSecond" ? "TOKENS / SECOND" : "SECONDS";
  let svg = `<svg viewBox="0 0 1020 350" class="chart" role="img" aria-label="${esc(currentMetric)} by input token count; exact values available in the table below"><text x="62" y="25" class="axis-label">${unit}</text>`;
  for (let i = 0; i <= 5; i++) {
    const value = (ymax * i) / 5;
    svg += `<line x1="62" x2="987" y1="${y(value)}" y2="${y(value)}" class="gridline"/><text x="48" y="${y(value) + 4}" text-anchor="end">${fmt(value, 0)}</text>`;
  }
  for (let i = 0; i <= 5; i++) {
    const value = (xmax * i) / 5;
    svg += `<text x="${x(value)}" y="325" text-anchor="middle">${num(value / 1000)}k</text>`;
  }
  svg +=
    '<text x="987" y="348" text-anchor="end" class="axis-label">INPUT TOKENS</text>';
  for (const s of series) {
    const points = rows
      .filter((r) => r.profile === s.profile && r.cacheMode === s.mode)
      .sort((a, b) => a.inputTokens - b.inputTokens);
    svg += `<path d="${points.map((r, i) => `${i ? "L" : "M"}${x(r.inputTokens)},${y(Number(r[key]))}`).join(" ")}" fill="none" stroke="${s.color}" stroke-width="2" ${s.mode === "exact-repeat" ? 'stroke-dasharray="5 5"' : ""}/>`;
    for (const r of points) {
      const label = `${r.caseLabel} · ${s.label} · ${num(r.inputTokens)} input · ${fmt(Number(r[key]))} ${unit.toLowerCase()}`;
      svg += `<circle class="point" tabindex="0" cx="${x(r.inputTokens)}" cy="${y(Number(r[key]))}" r="5" fill="${s.color}" data-point="${esc(label)}" aria-label="${esc(label)}"><title>${esc(label)}</title></circle>`;
    }
  }
  svg += "</svg>";
  $("#scaling-chart").innerHTML =
    legend(series.map((s) => [s.label, s.color])) +
    `<div class="chart-scroller">${svg}</div><div id="point-readout" class="chart-selection" aria-live="polite">Hover or focus a point to inspect it.</div>`;
  $("#scaling-chart")
    .querySelectorAll<SVGElement>("[data-point]")
    .forEach((p) => {
      const show = () => {
        $("#point-readout").textContent = p.dataset.point!;
      };
      p.addEventListener("mouseenter", show);
      p.addEventListener("focus", show);
      p.addEventListener("click", show);
    });
  $("#scaling-note").textContent =
    "One observation per task and cache condition. Task content changes across input sizes. Lines connect observations, not fitted predictions. The 49k replay is the same prompt across two whole serving profiles; this does not isolate speculation alone.";
  $("#scaling-table").innerHTML = table(
    [
      "Task",
      "Profile / cache",
      "Input",
      "Prefill s",
      "Decode tok/s",
      "Total s",
    ],
    rows.map((r) => [
      esc(r.caseLabel),
      esc(`${r.profile} / ${r.cacheMode}`),
      num(r.inputTokens),
      fmt(r.prefillSeconds),
      fmt(r.decodeTokensPerSecond, 1),
      fmt(r.wallSeconds),
    ]),
  );
}
function renderCache() {
  const size = Number($<HTMLSelectElement>("#cache-size").value) * 1000;
  const rows = current.measurements.filter(
    (r) =>
      r.experiment === "matrix" &&
      !r.group.includes("round3") &&
      r.outputAllowance === 20000 &&
      r.inputTokens > size - 500 &&
      r.inputTokens <= size,
  );
  const ceiling = size === 100000 ? 60 : 80;
  $("#cache-bars").innerHTML =
    legend([
      ["Cold median", "#325ce8"],
      ["Exact repeat", "#207e77"],
    ]) +
    cases
      .map((id, i) => {
        const cold = rows.filter(
            (r) => r.caseId === id && r.cacheMode === "cold",
          ),
          warm = rows.find(
            (r) => r.caseId === id && r.cacheMode === "exact-repeat",
          );
        const value = median(cold.map((r) => r.prefillSeconds));
        if (value == null || !warm)
          return empty(`No paired cache data for ${caseLabels[i]}.`);
        return `<div class="cache-row"><div><span>${caseLabels[i]}</span><small>${fmt(value)} → ${fmt(warm.prefillSeconds, 3)} s</small></div><div class="bar-track cold" title="Cold median ${fmt(value)} s, n=${cold.length}"><span style="width:${(value / ceiling) * 100}%"></span></div><div class="bar-track warm" title="Exact repeat ${fmt(warm.prefillSeconds, 3)} s"><span style="width:${(warm.prefillSeconds / ceiling) * 100}%"></span></div></div>`;
      })
      .join("");
}
function renderReasoning() {
  const rows = current.measurements.filter((r) =>
    r.group.startsWith("matrix-round3-"),
  );
  const colors: Record<string, string> = {
    off: "#9caec3",
    low: "#207e77",
    xhigh: "#325ce8",
  };
  $("#reasoning-chart").innerHTML =
    legend([
      ["Off", colors.off],
      ["Low", colors.low],
      ["Xhigh", colors.xhigh],
    ]) +
    cases
      .map(
        (id, i) =>
          `<div class="effort-group"><span>${caseLabels[i]}</span><div class="effort-bars">${[
            "off",
            "low",
            "xhigh",
          ]
            .map((e) => {
              const r = rows.find((r) => r.caseId === id && r.reasoning === e);
              return r
                ? `<div class="effort-line" title="${esc(e)}: ${fmt(r.wallSeconds)} seconds"><i style="width:${(r.wallSeconds / 190) * 100}%;background:${colors[e]}"></i><span>${fmt(r.wallSeconds, 1)}s</span></div>`
                : "";
            })
            .join("")}</div></div>`,
      )
      .join("");
  const thinking = current.measurements.filter(
    (r) => r.experiment === "thinking" && r.cacheMode === "cold",
  );
  $("#thinking-table").innerHTML = table(
    [
      "Task / group",
      "Input",
      "Allowance",
      "Output",
      "First answer s",
      "Time to stop/limit s",
      "API outcome",
    ],
    thinking.map((r) => [
      `${esc(r.caseLabel)}<br><span class="muted">${esc(r.group.replace("thinking-", ""))}</span>`,
      num(r.inputTokens),
      num(r.outputAllowance),
      num(r.outputTokens),
      fmt(r.firstAnswerSeconds),
      fmt(r.wallSeconds),
      `<span class="status ${r.finishReason === "length" ? "warn" : ""}">${esc(r.finishReason)}${r.hasAnswer ? "" : " · no answer"}</span>`,
    ]),
  );
}
function renderConversations() {
  const rows = current.measurements.filter(
    (r) =>
      r.experiment === "conversations" &&
      r.kind === "conversation" &&
      r.outputAllowance === cap,
  );
  $("#conversation-grid").innerHTML =
    `<div class="conversation-grid"><div></div>${[1, 2, 3, 4, 5, 6].map((t) => `<span class="turn-label">T${t}</span>`).join("")}${cases
      .map(
        (id, i) =>
          `<span class="row-label">${caseLabels[i]}</span>${[1, 2, 3, 4, 5, 6]
            .map((t) => {
              const r = rows.find((r) => r.caseId === id && r.turn === t);
              return r
                ? `<button class="turn-cell ${r.cachedTokens > 0 ? "cached" : ""}" data-turn="${t}" data-case="${id}" aria-pressed="${id === selectedCase && t === selectedTurn}" aria-label="${esc(caseLabels[i])}, turn ${t}, ${fmt(r.prefillSeconds)} seconds prefill, ${fmt(r.cacheFraction * 100, 1)} percent cache reused">${fmt(r.prefillSeconds, 1)}<small>${r.cachedTokens ? "reused" : "cold"}</small></button>`
                : "<span>—</span>";
            })
            .join("")}`,
      )
      .join("")}</div>`;
  $("#conversation-grid")
    .querySelectorAll<HTMLButtonElement>("button")
    .forEach((b) =>
      b.addEventListener("click", () => {
        selectedCase = b.dataset.case!;
        selectedTurn = Number(b.dataset.turn);
        renderConversations();
        $("#conversation-grid")
          .querySelector<HTMLButtonElement>("[aria-pressed=true]")
          ?.focus({ preventScroll: true });
      }),
    );
  const r = rows.find(
    (r) => r.caseId === selectedCase && r.turn === selectedTurn,
  );
  $("#turn-detail").innerHTML = r
    ? `<strong>${esc(r.caseLabel)} / turn ${r.turn}${r.review === "incomplete-and-incorrect" ? " · Incomplete migration handoff" : ""}</strong><div class="metrics-inline"><span>${num(r.cachedTokens)} / ${num(r.inputTokens)} input tokens cached (${fmt(r.cacheFraction * 100, 1)}%)</span><span>${num(r.outputTokens)} output tokens</span><span>${fmt(r.wallSeconds)} s total</span><span>API: ${esc(r.finishReason)}</span></div>`
    : empty("No conversation measurements.");
}
function renderQuality() {
  const rows = current.measurements.filter(
    (r) =>
      (r.experiment === "eos" && !r.ignoreEos) ||
      r.experiment === "mitigations",
  );
  $("#mitigation-table").innerHTML = table(
    [
      "Configuration",
      "Seed",
      "Generated",
      "Prefill s",
      "Decode tok/s",
      "Total s",
      "Reviewed ending",
    ],
    rows.map((r) => [
      r.experiment === "eos"
        ? "MTP · greedy (prior control)"
        : r.temperature === 1
          ? "MTP · T=1, p=.95, k=20"
          : "MTP disabled · greedy",
      num(r.seed),
      num(r.outputTokens),
      fmt(r.prefillSeconds),
      fmt(r.decodeTokensPerSecond, 1),
      fmt(r.wallSeconds),
      `<span class="status warn">${r.review === "complete-looking-with-errors" ? "Complete-looking; errors" : "Incomplete"}</span>`,
    ]),
  );
  $("#quality-cards").innerHTML = current.quality
    .map(
      (q) =>
        `<article class="quality-item"><span class="eyebrow">${esc(q.severity)} / MANUAL REVIEW</span><h3>${esc(q.title)}</h3><p>${esc(q.finding)}</p></article>`,
    )
    .join("");
}
function renderEnvironment() {
  const h = current.hardware,
    s = current.software;
  const specs = [
    ["GPU", `${h.gpu} · ${num(Number(h.vramMiB))} MiB`],
    ["CPU", h.cpu],
    ["Visible RAM", `${fmt(Number(h.ramBytes) / 2 ** 30, 1)} GiB`],
    ["OS / kernel", `${s.os} / ${s.kernel}`],
    ["NVIDIA driver", s.nvidiaDriver],
    ["Python", s.python],
    ["PyTorch", s.torch],
    ["vLLM", s.vllm],
    ["FlashInfer", s.flashinfer],
    ["Transformers", s.transformers],
    ["HyperQwen revision", current.upstream.revision],
  ];
  $("#environment").innerHTML = specs
    .map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`)
    .join("");
  $("#profiles").innerHTML =
    `<p>${esc(current.model.name)} · ${esc(current.model.quantization)}</p>${current.model.repositories.map((r) => `<p><a class="text-link" href="https://huggingface.co/${esc(r.repository)}/tree/${esc(r.revision)}">${esc(r.repository)} ↗</a><br><code>${esc(r.revision)}</code></p>`).join("")}<p>${esc(current.model.provenanceLimit)}</p>${current.profiles.map((p) => `<pre>${esc(JSON.stringify(p, null, 2))}</pre>`).join("")}`;
  $("#limits").innerHTML = current.limits
    .map((l) => `<li>${esc(l)}</li>`)
    .join("");
  $("#failures").innerHTML = current.failures
    .map(
      (f) =>
        `<div class="failure"><strong>${esc(f.stage)}</strong><p>${esc(f.detail)}</p></div>`,
    )
    .join("");
  $("#rig-title").innerHTML =
    `${esc(String(h.gpu).replace("NVIDIA GeForce ", ""))} <span>${fmt(Number(h.vramMiB) / 1024, 0)} GB</span>`;
  $("#rig-subtitle").textContent = `${h.cpu} · ${current.model.name} W4A16`;
}
function renderLedger() {
  const exp = $<HTMLSelectElement>("#experiment-filter").value,
    task = $<HTMLSelectElement>("#task-filter").value,
    cache = $<HTMLSelectElement>("#cache-filter").value;
  filtered = current.measurements.filter(
    (r) =>
      (exp === "all" || r.experiment === exp) &&
      (task === "all" || r.caseId === task) &&
      (cache === "all" || r.cacheMode === cache),
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  page = Math.min(page, totalPages - 1);
  $("#row-count").textContent =
    `${filtered.length} of ${current.measurements.length} requests · Click a task for the complete numerical record and evidence reference.`;
  const shown = filtered.slice(page * pageSize, (page + 1) * pageSize);
  $("#ledger").innerHTML = shown.length
    ? table(
        [
          "Task / experiment",
          "Profile · effort",
          "Cache",
          "Input",
          "Output / cap",
          "Prefill s",
          "Decode tok/s",
          "Total s",
          "API / review",
        ],
        shown.map((r) => [
          `<button class="row-detail" data-request="${esc(r.id)}">${esc(r.caseLabel)}${r.turn ? ` · T${r.turn}` : ""}</button><br><span class="muted">${esc(experimentLabels[r.experiment])}</span>`,
          `${esc(r.profile)}<br><span class="muted">${esc(r.reasoning)} · T=${r.temperature}</span>`,
          esc(r.cacheMode),
          num(r.inputTokens),
          `${num(r.outputTokens)} / ${num(r.outputAllowance)}`,
          fmt(r.prefillSeconds),
          fmt(r.decodeTokensPerSecond, 1),
          fmt(r.wallSeconds),
          `<span class="status ${r.finishReason === "length" ? "warn" : ""}">${esc(r.finishReason)}</span><br><span class="small">${esc(r.review)}</span>`,
        ]),
      )
    : empty("No requests match these filters.");
  $("#page-label").textContent = `Page ${page + 1} of ${totalPages}`;
  $<HTMLButtonElement>("#previous-page").disabled = page === 0;
  $<HTMLButtonElement>("#next-page").disabled = page >= totalPages - 1;
  $("#ledger")
    .querySelectorAll<HTMLButtonElement>("[data-request]")
    .forEach((b) =>
      b.addEventListener("click", () => {
        const r = current.measurements.find((r) => r.id === b.dataset.request)!;
        $("#request-json").textContent = JSON.stringify(
          {
            measurement: r,
            evidence: current.evidence.find((e) => e.id === r.evidenceId),
          },
          null,
          2,
        );
        $<HTMLDialogElement>("#request-dialog").showModal();
      }),
    );
}
function renderComparison() {
  const before = snapshots.find(
    (s) => s.id === $<HTMLSelectElement>("#compare-before").value,
  )!;
  const after = snapshots.find(
    (s) => s.id === $<HTMLSelectElement>("#compare-after").value,
  )!;
  if (snapshots.length < 2) {
    $("#comparison-result").innerHTML =
      '<div class="empty-state"><strong>One measured revision. No trend invented.</strong><p>This snapshot establishes the baseline. Add an immutable snapshot from the next measured release to compare matched requests. Hardware, model, method, prompt fingerprints, cache condition, and request settings are checked before showing deltas.</p><p><a class="text-link" href="./docs/adding-results.md">How to add the next release ↗</a></p></div>';
    return;
  }
  if (before.id === after.id) {
    $("#comparison-result").innerHTML = empty(
      "Choose two different snapshots.",
    );
    return;
  }
  const comparison = compareSnapshots(before, after);
  if (comparison.blocked) {
    $("#comparison-result").innerHTML = empty(
      `Comparison withheld: ${comparison.differences.join(", ")} changed. Use the separate ledgers to inspect both snapshots; no release delta is attributed.`,
    );
    return;
  }
  $("#comparison-result").innerHTML =
    `<p>${comparison.matched} matched request groups. ${comparison.differences.length ? "Software stack changed: these are whole-stack observations, not isolated upstream improvements." : "Recorded hardware, model, method and runtime metadata match."} Prefill medians only; positive change means slower. Different output lengths make total latency unsuitable as an isolated speedup claim.</p>` +
    (comparison.rows.length
      ? table(
          [
            "Task / group",
            "Cache",
            "Before s (n)",
            "After s (n)",
            "Prefill change",
          ],
          comparison.rows.map((r) => [
            `${esc(r.label)}<br><span class="small">${esc(r.group)}</span>`,
            esc(r.cacheMode),
            `${fmt(r.before)} (${r.beforeN})`,
            `${fmt(r.after)} (${r.afterN})`,
            `${r.changePercent >= 0 ? "+" : ""}${fmt(r.changePercent, 1)}%`,
          ]),
        )
      : empty(
          "No compatible requests with matching input fingerprints and settings.",
        ));
}
function renderSnapshot() {
  page = 0;
  const initial = current.id === initialId;
  // Editorial conclusions belong to their measured snapshot; future data never inherits them.
  for (const id of ["reasoning", "conversations", "quality"])
    $(`#${id}`).hidden = !initial;
  $(".cache-explainer").hidden = !initial;
  $("#snapshot-note").textContent =
    `${current.measuredFrom}–${current.measuredThrough} UTC · Revision ${current.upstream.revision.slice(0, 7)}. ${initial ? "One revision, multiple experiments." : "Selected snapshot: charts, environment and ledger updated. Initial-study editorial sections are hidden."}`;
  $("#json-download").setAttribute(
    "href",
    `./data/releases/${current.id}.json`,
  );
  $("#json-download").setAttribute("download", `${current.id}.json`);
  $("#experiment-filter").innerHTML =
    '<option value="all">All experiments</option>' +
    [...new Set(current.measurements.map((r) => r.experiment))]
      .map(
        (e) =>
          `<option value="${esc(e)}">${esc(experimentLabels[e] || e)}</option>`,
      )
      .join("");
  $("#task-filter").innerHTML =
    '<option value="all">All tasks</option>' +
    [
      ...new Map(
        current.measurements.map((r) => [r.caseId, r.caseLabel]),
      ).entries(),
    ]
      .map(([id, label]) => `<option value="${esc(id)}">${esc(label)}</option>`)
      .join("");
  renderStats();
  renderScaling();
  renderEnvironment();
  renderLedger();
  if (initial) {
    renderCache();
    renderReasoning();
    renderConversations();
    renderQuality();
  }
}
async function load() {
  const response = await fetch("./data/index.json");
  if (!response.ok) throw new Error(`Data index: HTTP ${response.status}`);
  const index = await response.json();
  snapshots = await Promise.all(
    index.releases.map(async (entry: any) => {
      if (!/^releases\/[a-z0-9-]+\.json$/.test(entry.file))
        throw new Error("Invalid snapshot path.");
      const response = await fetch(`./data/${entry.file}`);
      if (!response.ok) throw new Error(`Snapshot: HTTP ${response.status}`);
      const bytes = await response.arrayBuffer();
      const digest = Array.from(
        new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
      )
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      if (digest !== entry.sha256)
        throw new Error(
          "Snapshot integrity check failed. Rebuild the site from verified data.",
        );
      return JSON.parse(new TextDecoder().decode(bytes));
    }),
  );
  const options = snapshots
    .map((s) => `<option value="${esc(s.id)}">${esc(s.label)}</option>`)
    .join("");
  for (const id of ["snapshot", "compare-before", "compare-after"])
    $(`#${id}`).innerHTML = options;
  const requested = new URL(location.href).searchParams.get("snapshot");
  current = snapshots.find((s) => s.id === requested) || snapshots.at(-1)!;
  $<HTMLSelectElement>("#snapshot").value = current.id;
  $<HTMLSelectElement>("#compare-after").value = snapshots.at(-1)!.id;
  $<HTMLButtonElement>("#compare-button").disabled = snapshots.length < 2;
  renderSnapshot();
  renderComparison();
}
$<HTMLSelectElement>("#snapshot").addEventListener("change", () => {
  current = snapshots.find(
    (s) => s.id === $<HTMLSelectElement>("#snapshot").value,
  )!;
  const url = new URL(location.href);
  url.searchParams.set("snapshot", current.id);
  history.replaceState(null, "", url);
  renderSnapshot();
});
document.querySelectorAll<HTMLButtonElement>("[data-metric]").forEach((b) =>
  b.addEventListener("click", () => {
    currentMetric = b.dataset.metric!;
    setPressed("[data-metric]", "metric", currentMetric);
    renderScaling();
  }),
);
$("#cache-size").addEventListener("change", renderCache);
document.querySelectorAll<HTMLButtonElement>("[data-cap]").forEach((b) =>
  b.addEventListener("click", () => {
    cap = Number(b.dataset.cap);
    setPressed("[data-cap]", "cap", String(cap));
    renderConversations();
  }),
);
for (const id of ["experiment-filter", "task-filter", "cache-filter"])
  $(`#${id}`).addEventListener("change", () => {
    page = 0;
    renderLedger();
  });
$("#previous-page").addEventListener("click", () => {
  page--;
  renderLedger();
});
$("#next-page").addEventListener("click", () => {
  page++;
  renderLedger();
});
$("#compare-button").addEventListener("click", renderComparison);
$("#close-dialog").addEventListener("click", () =>
  $<HTMLDialogElement>("#request-dialog").close(),
);
$("#csv-download").addEventListener("click", () => {
  const url = URL.createObjectURL(
    new Blob([toCsv(filtered)], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `${current.id}-filtered.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
load().catch((error) => {
  $("#snapshot-note").textContent = "Data could not be loaded.";
  $("#stats").innerHTML =
    `<div class="load-error" role="alert">${esc(error.message)} Run the built site over HTTP or HTTPS; see the README for preview instructions.</div>`;
  console.error(error);
});
