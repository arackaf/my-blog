---
title: Building a blog in TanStack Part 2
date: "2026-02-16T10:00:00.000Z"
description: An introduction to building a blog in TanStack Start Part 2
---

In part 1 of our post we built a blog in TanStack Start. We set up Shiki for code formatting, and we created server functions to inspect the file system and discover our blog posts (in markdown files), as well as put together the actual blog content for any single post.

## Performance issues

It turns out that the Shiki setup, which lives in the top-level `async function getMarkdownIt() {` method we saw in part 1 takes no small amount of time to set up. It's not that the function is slow to call; it's quite fast, in fact. But the initial _parsing_ of this module is extremely slow. On my own, modern MacBook Pro is takes about 2 _seconds_ (2000ms) to parse.

This means that, when your web server first spins up, and processes the import graph, this particular function will block the process for about 2 seconds. You might this that, for a blog, this is an unimportant cost: it's just spin-up time, after all, which happens only once.

## Cold Starts

Or does it? What if you deploy this site to Netlify, Vercel, or any other serverless platform, like AWS Lambda. With that deployment model, cloud functions will constantly be spinning up, to process requests. This spin-up time is called a "cold start," and is a well known issue with Serverless. Usually cold start times are reaosnable, and modern platforms like Netlify and Vercel will "pre-warm" serverless functions to minimize this cost from happening at all.

## Going static

Rather than debate the importance of minimizing cold starts for a blog that likely has few readers, let's take a step back: do we even need a server at all? Blogs are inherently static. Any modern web framework provides a way to statically prerender content. This is exactly what we need. Why not just pre-render our blog pages, and then we can render them anywhere, without any server processing. We could even just toss the built static assets onto a CDN.

## Pre-rendering our pages

To start, let's go into the our vite.config.ts file, and add a setting to the TanStack plugin

```ts
tanstackStart({
  prerender: {
    enabled: true,
  },
}),
```

This enables, well, prerendering. Now, during build, TanStack will crawl declared pages, and crawl links therein, and so on. So it will start with our / route, it will build the page, with all our blog posts, which includes the `<Link>` tags to each. From there, each Link on the page will be crawled. If those pages had links, they'd be crawled as well.

When we run our build, we can see this in action

![Crawling during build](/tanstack-blog-post/img5.png)

We can look at the output of this build by peaking inside the .output folder, which the Nitro (the default deployment adapter) creates

![Built assets](/tanstack-blog-post/img6.png)

As we can see, the /public folder contains everything that can be routed to directly. Our index.html is in there, as well as paths to both blogs, and the images links from blog post-2.

## Running our content as a static website

Uploading these files to an S3 bucket would be a bit over the top for this post, but to test true static rendering more simply I've put together these two scripts on this post's repo

```
"generate-static-site": "npm run build && rm -rf static-site && mkdir -p static-site && cp -r .output/. static-site",
"start-static-server": "npx tsx static-server.ts"
```

Basically a script to run build, and copy the contents to a folder called `static-site`.

And then a script to run `static-server.ts`. This file looks like this, in its entirety.

```ts
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3003;

// Serve static files from the static-site directory
app.use(express.static(path.join(__dirname, "static-site/public")));

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
```

It fires up Express, and points the static middleware at /public inside the static-site folder we just copied out build into.

When we run this app, all of our pages work when we browse directly to them.

![Page works](/tanstack-blog-post/img7.png)

and

![Other page works](/tanstack-blog-post/img8.png)

These pages work if we navigate directly to them in our browser's url bar. But if we click around in our app, these pages fail.

![Navigation error](/tanstack-blog-post/img9.png)

Looking in the network tab makes this even clearer.

![Network tab](/tanstack-blog-post/img10.png)

As we _navigate_ our server function is being called. Didn't we prerender these pages?

## How TanStack does prerendering

Our pre-rendered html file is indeed rendered by our Express server. But when it is, script tags containing the normal TanStack app will spin up, and take over. At the end of the day, TanStack Start is generating the same kind of application either way, except in this case the initial render is served from a pre-generated html file, rather than server rendering.

From there on, Link tags trigger normal client-side loading, which trigger the server functions, as usual.

TanStack Start does not try to morph itself into a full MPA framework just to handle static web apps. Instead, it gives you the primitives to achieve this yourself.

We already saw the first, which was static prerendering. Now let's look at the other.

## Static server functions

Our client navigation will run either way, but the real problem is our server functions. To solve this, TanStack provides static middleware we can apply to server functions. This causes our server functions to record invocations, and results during build, and then save those payloads to simple json files in the build output we already saw.

Let's try it!

```
npm i @tanstack/start-static-server-functions
```

and them import it

```ts
import { staticFunctionMiddleware } from "@tanstack/start-static-server-functions";
```

and then apply it to our server functions

```ts
export const getPostContent = createServerFn()
  .inputValidator((data: { slug: string }) => data)
  .middleware([staticFunctionMiddleware])
  .handler(async ({ data }) => {
```

Now when we run our build, we see something new in there

![Network tab](/tanstack-blog-post/img11.png)

\_\_tsr refers to TanStack Router, and the `staticServerFnCache` contains the 3 server function calls from parsing our blog: one for the index page, and one each for the two posts we have.

The plugin recorded those invocations and results, and more importantly, replaced those call sites with fetches to those json files in the \_\_tsr folder.

If we run our blog again, we can navigate, and see much simpler fetches for those json files, which replace the original calls to the actual server function.

## Concluding thoughts

Happy Coding!
