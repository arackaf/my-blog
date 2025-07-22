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
          options.attributes = {};
          options.attributes.lineNumbers = true;
        },
      },
      {
        name: "line-numbers-2",
        postprocess: (html, options) => {
          console.log("html", typeof html);
          console.log("options:", options);

          if (options?.attributes?.lineNumbers) {
            console.log("DO IT");
            return html.replace(/<pre /g, "<pre data-linenumbers ");
          }
          return html;
          //options.attributes = {};
          //options.attributes["data-foo"] = " XXX ";
        },
      },
    ],
  })
);

export default async function markdownToHtml(markdown) {
  return md.render(markdown);
}
