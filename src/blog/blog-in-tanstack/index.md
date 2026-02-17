---
title: Building a blog in TanStack Part 1
date: "2026-02-16T10:00:00.000Z"
description: An introduction to building a blog in TanStack Start
---

TanStack Start is one of the newest web frameworks around, whose popularity is rising quickly. Start is actually a thin server-side layer which sits on top of TanStack Router, and provides things like server functions, api endpoints, and server-side rendering. I wrote a three-part introduction to Router [here](https://frontendmasters.com/blog/introducing-tanstack-router/), and an introduction to Start [here](https://frontendmasters.com/blog/introducing-tanstack-start/).

This post will be a bit different. We'll explore TanStack start via a more traditional, old-school use case: we'll implement a blog. It's somewhat of a cliche, but it will let us explore some important features, like server functions and routing parameters, and also some niche patters, like static pre-generation and static server function middleware.

Here in part 1 we'll implement our blog. Then in part 2, we'll explore static generation in order to deploy it in the most sensible way.

Let's get started!

## Getting started

We'll write our blog posts in markdown files. We'll scan the appropriate directory to discover the posts we have, to generate links to them all. Then for the actual page that displays an individual blog post, we'll read the markdown content, and generate html from it, complete with code highlighting.

As a good first step, we'll need to read in a simple list of all blog posts which exist. Our blog posts are each in a folder named for the post in question, and inside of each folder is index.md.

![Markdown files](/tanstack-blog-post/img1.png)

We just want these posts' names, so we can generate links on our homepage. Vite actually has a nice `import.meta.glob` method to read in all files in a dynamic way.

```ts
const allPosts: Record<string, any> = import.meta.glob("../blog/**/*.md", { query: "?raw", eager: true });
```

From there, we can inspect the url of each .md file we find, and get the correct name. Here's the entire method to do this.

```ts
export const getAllBlogPosts = () => {
  const allPosts: Record<string, any> = import.meta.glob("../blog/**/*.md", { query: "?raw", eager: true });

  return Object.entries(allPosts).reduce(
    (result, [key, module]) => {
      const paths = key.split("/");
      const slug = paths.at(-2)!;

      result[slug] = module.default;
      return result;
    },
    {} as Record<string, string>,
  );
};
```

## Concluding thoughts

Happy Coding!
