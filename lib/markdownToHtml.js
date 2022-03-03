import { remark } from "remark";
import html from "remark-html";
import remarkPrism from "remark-prism";

export default async function markdownToHtml(markdown) {
  console.log(markdown);
  const result = await remark()
    .use(html, { sanitize: false })
    .use(remarkPrism, { plugins: ["line-numbers"] })
    .process(markdown);
  return result.toString();
}
