import { useEffect, useRef } from "react";

export default function PostBody({ content }) {
  const rootRef = useRef<HTMLDivElement>(null);

  function highlightCode(pre, highlightRanges, lineNumberRowsContainer) {}

  useEffect(() => {
    const allPres = rootRef.current.querySelectorAll("pre");

    for (const pre of allPres) {
      const code = pre.firstElementChild;
      if (!/code/i.test(code.tagName)) {
        continue;
      }

      const highlightRanges = pre.dataset.line;
      const lineNumberRowsContainer = pre.querySelector(".line-numbers-rows");

      if (!highlightRanges || !lineNumberRowsContainer) {
        continue;
      }
      const ranges = highlightRanges.split(",").filter(val => val);
      const preWidth = pre.scrollWidth;

      for (const range of ranges) {
        let [start, end] = range.split("-");
        if (!start || !end) {
          start = range;
          end = range;
        }

        for (let i = +start; i <= +end; i++) {
          const lineNumberSpan: HTMLSpanElement =
            lineNumberRowsContainer.querySelector(`span:nth-child(${i})`);
          lineNumberSpan.style.setProperty(
            "--highlight-background",
            "rgba(100, 100, 100, 0.5)"
          );
          lineNumberSpan.style.setProperty(
            "--highlight-width",
            `${preWidth}px`
          );
        }
      }
    }
  }, []);

  return (
    <div ref={rootRef} className="max-w-2xl mx-auto">
      <div style={{ display: "flex" }}>
        <div className={""} dangerouslySetInnerHTML={{ __html: content }} />
      </div>
    </div>
  );
}
