import { useEffect, useRef } from "react";

export default function PostBody({ content }) {
  const rootRef = useRef(null);
  useEffect(() => {
    const allPres = rootRef.current.querySelectorAll("pre");

    console.log("All Pre", allPres);

    for (const pre of allPres) {
      const code = pre.firstChild;
      if (!/code/i.test(code.tagName)) {
        continue;
      }
    }
  }, []);

  return (
    <div ref={rootRef} className="max-w-2xl mx-auto">
      <div className={""} dangerouslySetInnerHTML={{ __html: content }} />
    </div>
  );
}
