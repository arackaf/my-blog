import Shiki from "@shikijs/markdown-it";
import MarkdownIt from "markdown-it";

const md = MarkdownIt();

md.use(
  await Shiki({
    themes: {
      light: "dark-plus",
      dark: "dark-plus",
    },
    transformers: [
      {
        name: "line-numbers",
        preprocess: (code, options, meta) => {
          console.log("code", code);
          console.log("options", options);
          console.log("meta", meta);

          if (options?.meta?.__raw?.includes("lineNumbers")) {
            options.attributes = {};
            options.attributes.lineNumbers = true;
          }
        },
      },
      {
        name: "line-numbers-2",
        postprocess: (html, options) => {
          if (options?.attributes?.lineNumbers) {
            console.log("DO IT");
            return html.replace(/<pre /g, "<pre data-linenumbers ");
          }
          console.log("NO");
          return html;
        },
      },
    ],
  })
);

export default async function markdownToHtml(markdown) {
  return md.render(markdown);
}
