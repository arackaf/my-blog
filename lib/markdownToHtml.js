import Shiki from "@shikijs/markdown-it";
import MarkdownIt from "markdown-it";

const md = MarkdownIt();

md.use(
  await Shiki({
    themes: {
      light: "dark-plus",
      dark: "dark-plus",
    },
  })
);

export default async function markdownToHtml(markdown) {
  return md.render(markdown);
}
