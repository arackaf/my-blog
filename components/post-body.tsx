import { useEffect, useRef } from "react";

export default function PostBody({ content }) {
  const rootRef = useRef<HTMLDivElement>(null);

  function highlightCode(pre, highlightRanges, lineNumberRowsContainer) {
    const ranges = highlightRanges.split(",").filter(val => val);
    const preWidth = pre.scrollWidth;

    for (const range of ranges) {
      let [start, end] = range.split("-");
      if (!start || !end) {
        start = range;
        end = range;
      }

      for (let i = +start; i <= +end; i++) {
        const lineNumberSpan: HTMLSpanElement = lineNumberRowsContainer.querySelector(`span:nth-child(${i})`);
        lineNumberSpan.style.setProperty("--highlight-background", "rgba(100, 100, 100, 0.5)");
        lineNumberSpan.style.setProperty("--highlight-width", `${preWidth}px`);
      }
    }
  }

  useEffect(() => {
    const allPres = rootRef.current.querySelectorAll("pre");
    const cleanup: (() => void)[] = [];

    for (const pre of allPres) {
      const code = pre.firstElementChild;
      if (!/code/i.test(code.tagName)) {
        continue;
      }

      const highlightRanges = pre.dataset.line;
      const lineNumbersContainer = pre.querySelector(".line-numbers-rows");

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
    <div ref={rootRef} className="max-w-2xl mx-auto">
      <div style={{ width: "50%" }}>
        <div className={""} dangerouslySetInnerHTML={{ __html: content }} />
      </div>
    </div>
  );
}
