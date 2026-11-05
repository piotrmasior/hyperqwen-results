const status = document.querySelector<HTMLElement>("#copy-status")!;
for (const button of document.querySelectorAll<HTMLButtonElement>(
  "button[data-copy]",
)) {
  button.hidden = false;
  button.addEventListener("click", async () => {
    const code = document.getElementById(button.dataset.copy!)!;
    try {
      await navigator.clipboard.writeText(code.textContent || "");
      button.textContent = "Copied ✓";
      status.textContent = `${button.getAttribute("aria-label")} copied to clipboard.`;
      setTimeout(() => {
        button.textContent = "Copy";
      }, 2000);
    } catch {
      const range = document.createRange();
      range.selectNodeContents(code);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      status.textContent =
        "Clipboard unavailable. Command selected; copy it with your keyboard.";
    }
  });
}
