// Deliberately small Markdown subset for the checked-in runbook, not a general parser.
export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}

export function inline(value: string): string {
  const token = /`([^`]+)`|\[([^\]]+)\]\(([^\s)]+)\)/g;
  let html = "",
    end = 0;
  for (const match of value.matchAll(token)) {
    html += escapeHtml(value.slice(end, match.index));
    if (match[1]) html += `<code>${escapeHtml(match[1])}</code>`;
    else {
      const href = match[3];
      if (!/^(https:\/\/|[a-zA-Z0-9][a-zA-Z0-9_./#-]*$)/.test(href))
        throw new Error(`Unsupported guide link: ${href}`);
      const target =
        href.endsWith(".md") && !href.startsWith("https:")
          ? `./docs/${href}`
          : href;
      html += `<a href="${escapeHtml(target)}">${escapeHtml(match[2])}</a>`;
    }
    end = match.index! + match[0].length;
  }
  return html + escapeHtml(value.slice(end));
}

export function renderGuide(markdown: string) {
  const lines = markdown.replaceAll("\r\n", "\n").split("\n");
  const toc: { id: string; title: string; number: string }[] = [];
  const ids = new Set<string>();
  let intro = "",
    body = "",
    section = false,
    codeCount = 0;
  const append = (html: string) => {
    if (section) body += html;
    else intro += html;
  };
  for (let i = 0; i < lines.length;) {
    const line = lines[i];
    if (!line.trim() || line.startsWith("# ")) {
      i++;
      continue;
    }
    if (line.startsWith("## ")) {
      if (section) body += "</section>";
      section = true;
      const heading = line.slice(3),
        match = /^(\d+) · (.+)$/.exec(heading);
      const title = match ? match[2] : heading,
        number = match ? match[1] : "+";
      const id = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      if (ids.has(id)) throw new Error(`Duplicate heading: ${id}`);
      ids.add(id);
      toc.push({ id, title, number });
      body += `<section class="guide-step" id="${id}" aria-labelledby="heading-${id}"><div class="step-heading"><span class="step-number">${number}</span><h2 id="heading-${id}">${escapeHtml(title)}</h2></div>`;
      i++;
      continue;
    }
    if (line.startsWith("```")) {
      const language = line.slice(3),
        code: string[] = [];
      i++;
      while (i < lines.length && lines[i] !== "```") code.push(lines[i++]);
      if (i === lines.length) throw new Error("Unclosed runbook code fence");
      i++;
      codeCount++;
      append(
        `<div class="command"><div class="command-bar"><span>${escapeHtml(language || "text")} / COMMAND ${String(codeCount).padStart(2, "0")}</span><button type="button" data-copy="command-${codeCount}" aria-label="Copy command ${codeCount}" hidden>Copy</button></div><pre tabindex="0" aria-label="Command ${codeCount}"><code id="command-${codeCount}">${escapeHtml(code.join("\n") + "\n")}</code></pre></div>`,
      );
      continue;
    }
    if (line.startsWith("- ")) {
      let list = "<ul>";
      while (i < lines.length && lines[i].startsWith("- "))
        list += `<li>${inline(lines[i++].slice(2))}</li>`;
      append(list + "</ul>");
      continue;
    }
    const paragraph: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#|```|- )/.test(lines[i]))
      paragraph.push(lines[i++]);
    if (!paragraph.length) throw new Error(`Unsupported Markdown: ${lines[i]}`);
    const content = paragraph.join(" ");
    append(
      `<p${content.startsWith("Checkpoint:") ? ' class="checkpoint"' : ""}>${inline(content)}</p>`,
    );
  }
  if (section) body += "</section>";
  return {
    intro,
    body,
    toc: toc
      .map(
        ({ id, title, number }) =>
          `<li><a href="#${id}"><span>${number}</span>${escapeHtml(title)}</a></li>`,
      )
      .join(""),
    codeCount,
    sectionCount: toc.length,
  };
}
