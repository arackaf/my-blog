import Shiki from "@shikijs/markdown-it";
import MarkdownIt from "markdown-it";

export default async function markdownToHtml(markdown: string) {
  const md = MarkdownIt({
    html: true,
  });

  md.use(
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

  return md.render(markdown);
}
