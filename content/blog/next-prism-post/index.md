---
title: Fully integrarting Prism and Next for Code highlighting
date: "2022-03-23T20:00:32.169Z"
description: Diving into all the tips and tricks for fully integrating Prism with Next, for full Syntax highlighting
---

So you've decided to build a blog with Next. You're writing your first post, and you'd like the have the code snippets formatted nicely, with line numbers, and maybe even line highlighting, so you can call attention to certain lines. For this post, we'll be using Prism for our code formatting, which is a superb utility.

Unfortunately, the details for how to get everything integrated can be hidden in plain sight, and for line highlighting in particular, not _directly_ supported, requiring some creativity on our part. This post will walk you through all of this.

This post will assume you're using the Next blog starter, which is located [here](https://github.com/vercel/next.js/tree/canary/examples/blog-starter). That repo has clear (and simple) getting started instructions. Scaffold the blog, and we'll get started.

## Basic Prism integration

The Next blog package uses Remark to turn Markdown into blog posts, and so we'll use remark-prism to get code formatting working. Install it with your favorite package manager:

```bash
npm i remark-prism
```

Now go into the markdownToHtml file, in the `lib` folder, and switch on remark-prism with this line

```js
  .use(remarkPrism, { plugins: ["line-numbers"] })
```

the whole module should now look like this

```js
import { remark } from "remark";
import html from "remark-html";
import remarkPrism from "remark-prism";

export default async function markdownToHtml(markdown) {
  const result = await remark()
    .use(html)
    .use(remarkPrism, { plugins: ["line-numbers"] })
    .process(markdown);

  return result.toString();
}
```

## Putting some styles in place

Now let's import some css that Prism needs. In the pages/\_app.js file (or somewhere else, if you'd prefer), let's import the main Prism stylesheet, and the one for whichever theme you'd like to use. I'm using the tomorrow theme, so mine looks like this

```js
import "prismjs/themes/prism-tomorrow.css";
import "prismjs/plugins/line-numbers/prism-line-numbers.css";
```

and with that, we now have some basic styles

TODO: image
