import { useEffect, useRef } from "react";

export default function PostBody({ content }: { content: string }) {
  const rootRef = useRef<HTMLDivElement>(null);

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
