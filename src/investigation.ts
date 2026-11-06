import { escapeHtml as esc } from "./render-utils.ts";

const $ = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const num = (n: number, digits = 0) => n.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits });
const table = (head: string[], rows: (string | number)[][]) => `<table><thead><tr>${head.map(x => `<th scope="col">${esc(x)}</th>`).join("")}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(x => `<td>${esc(String(x))}</td>`).join("")}</tr>`).join("")}</tbody></table>`;

async function load() {
  const root = "./data/investigations/";
  const response = await fetch(root + "index.json");
  if (!response.ok) throw new Error(`Index: HTTP ${response.status}`);
  const index = await response.json();
  const entry = index.investigations.find((x: any) => x.id === "2026-11-06-quality-6ab9bd0");
  if (!entry || !/^[a-z0-9-]+\.json$/.test(entry.file)) throw new Error("Missing or invalid investigation index");
  const result = await fetch(root + entry.file);
  if (!result.ok) throw new Error(`Data: HTTP ${result.status}`);
  const bytes = await result.arrayBuffer();
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), x => x.toString(16).padStart(2, "0")).join("");
  if (digest !== entry.sha256) throw new Error("Investigation checksum mismatch");
  const data = JSON.parse(new TextDecoder().decode(bytes));
  const labels = Object.fromEntries(data.reviewedPackages.map((p: any) => [p.id, p.label]));

  $("#checks-table").innerHTML = table(["Scenario", "Independent development", "Generated", "Reused regression", "SQL controls", "First held-out"], data.reviewedPackages.map((p: any) => [p.label, p.development, p.generated, p.regression, p.reportSQL, `${p.firstHeldOutPassed}/${p.firstHeldOutTotal}`]));
  const failures = ["Final tests: nullable rowCount compiler error", "Final tests: private-field compiler errors", "Three incomplete test responses", "Final test setup failed; 24 tests canceled"];
  $("#fresh-table").innerHTML = table(["Scenario", "Calls", "Output tokens", "Request wall (s)", "Implementation", "Blocked at"], data.fresh45.cases.map((c: any, i: number) => [labels[c.id], c.calls, num(c.outputTokens), num(c.wallSeconds, 2), "Compiles", failures[i]]));
  const endings = ["Mid-table", "Mid-sentence", "Unfinished retention section", "Mid-sentence"];
  $("#full-table").innerHTML = table(["Scenario", "Input tokens", "Output tokens", "Prefill (s)", "Decode tok/s", "Wall (s)", "Completion"], data.attention.fullGenerations.map((c: any, i: number) => [labels[c.id], num(c.inputTokens), num(c.outputTokens), num(c.prefillSeconds, 2), num(c.decodeTokensPerSecond, 2), num(c.wallSeconds, 2), endings[i]]));
  $("#probe-table").innerHTML = table(["Prefix", "Tokens", "Fast EOS", "BF16 attention EOS", "Reduction (percentage points)"], data.attention.shortProbes.map((p: any) => [labels[p.id], num(p.promptTokens), `${num(p.baselineEosPercent, 6)}%`, `${num(p.attentionBf16EosPercent, 6)}%`, num(p.percentagePointReduction, 6)]));
  const renderProbe = (id: string) => {
    const p = data.attention.shortProbes.find((x: any) => x.id === id);
    $("#probe-context").textContent = `${labels[id]} · ${num(p.promptTokens)} tokens · 0–100% probability scale`;
    $("#probe-chart").innerHTML = [["Fast W4A16", p.baselineEosPercent], ["BF16 attention", p.attentionBf16EosPercent]].map(([label, n]) => `<div class="probe-row"><span>${esc(String(label))}</span><div class="probe-track"><i style="width:${n}%"></i></div><strong>${num(n as number, 2)}%</strong></div>`).join("") + `<p class="probe-readout">${id === "02-incident" ? "Top token: EOS → continuation. 42.73 percentage-point reduction." : "Top token: newline → newline. No meaningful reduction at this prefix."}</p>`;
    document.querySelectorAll<HTMLButtonElement>("[data-probe]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.probe === id)));
  };
  document.querySelectorAll<HTMLButtonElement>("[data-probe]").forEach(b => b.addEventListener("click", () => renderProbe(b.dataset.probe!)));
  renderProbe("02-incident");
  const renderCosts = () => {
    const sort = $("#cost-sort") as HTMLSelectElement;
    const groups = Object.entries(data.costs.groups) as [string, any][];
    groups.sort((a, b) => b[1][sort.value] - a[1][sort.value]);
    $("#cost-table").innerHTML = table(["Experiment", "Calls", "Output tokens", "Request wall (min)", "API stop", "API length"], groups.map(([id, x]) => [id, x.calls, num(x.outputTokens), num(x.wallSeconds / 60, 2), x.stop, x.length]));
  };
  $("#cost-sort").addEventListener("change", renderCosts);
  renderCosts();
  $("#cost-csv").addEventListener("click", () => {
    const fields = ["id", "group", "startedUTC", "outputTokens", "wallSeconds", "finishReason"];
    const cell = (x: unknown) => `"${String(x).replaceAll('"', '""')}"`;
    const csv = [fields.join(","), ...data.costs.measurements.map((x: any) => fields.map(k => cell(x[k])).join(","))].join("\r\n") + "\r\n";
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "hyperqwen-quality-2026-11-06-generations.csv"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  $("#investigation-environment").innerHTML = table(["Environment", "Observed value"], [
    ["GPU / CPU", `${data.hardware.gpu} × ${data.hardware.gpuCount} / ${data.hardware.cpu}`],
    ["GPU memory / system RAM", `${num(data.hardware.vramMiB)} MiB / ${num(data.hardware.ramBytes / 2**30, 1)} GiB`],
    ["Power limit", `${data.hardware.powerLimitWatts} W; limit, not measured power draw or energy`],
    ...Object.entries(data.software).map(([k, v]) => [k, String(v)]),
    ["Fast checkpoint", `${data.model.fastRepository.repository} @ ${data.model.fastRepository.revision}`],
    ["Prepared-weight provenance", data.model.provenanceLimit],
    ["Execution sandbox", "PostgreSQL 17.11 / Node 22.23.4 / TypeScript 5.9.3 / pg 8.23.1"],
  ]);
  $("#source-hashes").innerHTML = `<table><thead><tr><th scope="col">Retained evidence</th><th scope="col">SHA-256</th></tr></thead><tbody>${data.sources.map((s: any) => `<tr><td>${esc(s.id)}</td><td><code>${esc(s.sha256)}</code></td></tr>`).join("")}</tbody></table>`;
  $("#data-status").textContent = `Verified SHA-256 ${digest}. ${data.costs.calls} unique measured requests. Evidence checkpoint: ${data.costs.checkpointUTC}.`;
  // Data tables change section heights; honor a direct section link after rendering.
  const section = document.getElementById(location.hash.slice(1));
  if (section) section.scrollIntoView({ behavior: "instant" });
}
load().catch(error => {
  $("#data-status").textContent = `Interactive data unavailable: ${error.message}. Use the report and JSON download links above.`;
  $("#cost-csv").setAttribute("disabled", "");
});
