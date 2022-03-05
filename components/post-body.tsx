import { useEffect, useRef } from "react";

export default function PostBody({ content }) {
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const allPres = rootRef.current.querySelectorAll("pre");

    for (const pre of allPres) {
      const code = pre.firstElementChild;
      if (!/code/i.test(code.tagName)) {
        continue;
      }

      const highlight = pre.dataset.line;
      const lineNumberRows = pre.querySelector(".line-numbers-rows");

      if (!highlight || !lineNumberRows) {
        continue;
      }
      const ranges = highlight.split(",").filter(val => val);
      const preWidth = pre.scrollWidth;

      for (const range of ranges) {
        let [start, end] = range.split("-");
        if (!start || !end) {
          start = range;
          end = range;
        }

        for (let i = +start; i <= +end; i++) {
          const lineNumberSpan: HTMLSpanElement = lineNumberRows.querySelector(
            `span:nth-child(${i})`
          );
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
      <div className={""} dangerouslySetInnerHTML={{ __html: content }} />
    </div>
  );
}
