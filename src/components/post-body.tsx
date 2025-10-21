import { useEffect, useRef } from "react";

export default function PostBody({ content }: { content: string }) {
  const rootRef = useRef<HTMLDivElement>(null);

  function highlightCode(pre: HTMLElement, highlightRanges: string, lineNumberRowsContainer: HTMLElement) {
    const ranges = highlightRanges.split(",").filter(val => val);
    const preWidth = pre.scrollWidth;

    for (const range of ranges) {
      let [start, end] = range.split("-");
      if (!start || !end) {
        start = range;
        end = range;
      }

      for (let i = +start; i <= +end; i++) {
        const lineNumberSpan: HTMLSpanElement = lineNumberRowsContainer.querySelector(`span:nth-child(${i})`)!;
        lineNumberSpan.style.setProperty("--highlight-background", "rgba(100, 100, 100, 0.5)");
        lineNumberSpan.style.setProperty("--highlight-width", `${preWidth}px`);
      }
    }
  }

  function createCopyButton(codeEl: HTMLElement) {
    const button = document.createElement("button");
    button.classList.add("prism-copy-button");
    button.textContent = "Copy";

    button.addEventListener("click", () => {
      if (button.textContent === "Copied") {
        return;
      }
      navigator.clipboard.writeText(codeEl.textContent || "");
      button.textContent = "Copied";
      button.disabled = true;
      setTimeout(() => {
        button.textContent = "Copy";
        button.disabled = false;
      }, 3000);
    });

    return button;
  }

  useEffect(() => {
    const allPres = rootRef.current?.querySelectorAll("pre");
    const cleanup: (() => void)[] = [];

    for (const pre of allPres ?? []) {
      const code = pre.firstElementChild;
      if (!code || !/code/i.test(code.tagName)) {
        continue;
      }

      pre.appendChild(createCopyButton(code as HTMLElement));

      const highlightRanges = pre.dataset.line;
      const lineNumbersContainer = pre.querySelector(".line-numbers-rows") as HTMLElement;

      if (!highlightRanges || !lineNumbersContainer) {
        continue;
      }

      const runHighlight = () => highlightCode(pre, highlightRanges, lineNumbersContainer);
      runHighlight();

      const ro = new ResizeObserver(runHighlight);
      ro.observe(pre);

      cleanup.push(() => ro.disconnect());
    }

    return () => cleanup.forEach(f => f());
  }, []);

  return (
    <div ref={rootRef}>
      <div>
        <div dangerouslySetInnerHTML={{ __html: content }} />
      </div>
    </div>
  );
}
