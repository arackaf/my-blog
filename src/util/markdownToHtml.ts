import Shiki from "@shikijs/markdown-it";
import MarkdownIt from "markdown-it";

let markdownIt: MarkdownIt | null = null;

async function getMarkdownIt() {
  if (markdownIt) {
    return markdownIt;
  }

  markdownIt = MarkdownIt({
    html: true,
  });

  markdownIt.use(
    await Shiki({
      themes: {
        light: "dark-plus",
        dark: "dark-plus",
      },
      transformers: [
        {
          name: "line-numbers-pre",
          preprocess: (_: string, options: any) => {
            if (options?.meta?.__raw?.includes("lineNumbers")) {
              options.attributes = {};
              options.attributes.lineNumbers = true;
            }
          },
        },
        {
          name: "line-numbers-post",
          postprocess: (html, options: any) => {
            if (options?.attributes?.lineNumbers) {
              return html.replace(/<pre /g, "<pre data-linenumbers ");
            }
            return html;
          },
        },
      ],
    }),
  );

  return markdownIt;
}

export default async function markdownToHtml(markdown: string) {
  const md = await getMarkdownIt();

  return md.render(markdown);
}
