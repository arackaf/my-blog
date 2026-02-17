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

### Finding the posts

As a good first step, we'll need to read in a simple list of all blog posts which exist. Our blog posts are each in a folder named for the post in question, and inside of each folder is index.md.

![Markdown files](/tanstack-blog-post/img1.png)

We just want these posts' names, so we can generate links on our homepage. Vite actually has a nice `import.meta.glob` method to read in all files in a dynamic way.

```ts
const allPosts: Record<string, any> = import.meta.glob("../blog/**/*.md", { query: "?raw", eager: true });
```

From there, we can inspect the url of each .md file we find, and get the correct name. Here's the entire method for this.

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

### Reading metadata about each blog post

We'll use `gray-matter` to read metadata from our blog posts.

```ts
import matter from "gray-matter";
```

This will allow us to put metadata at the top of our blog markdown file

```
---
title: Post 1
date: "2025-12-05T10:00:00.000Z"
description: Post 1
---
```

And then get the title, date and description.

We'll whip up some types

```ts
export type PostMetadata = {
  title: string;
  date: string;
  description: string;
  slug: string;
  author: string;
  ogImage: string;
  coverImage: string;
};

export type Post = PostMetadata & {
  content: string;
};
```

and helpers

```ts
const metadataFields: (keyof PostMetadata)[] = ["title", "date", "description", "slug", "author", "ogImage", "coverImage"];
const postFields: (keyof Post)[] = [...metadataFields, "content"];
```

And then a function to read the metadata for a single blog post.

```ts
export function getPostMetadata(slug: string, fileContents: string): PostMetadata {
  const { data } = matter(fileContents);

  const result: PostMetadata = {
    slug,
  } as PostMetadata;

  // Ensure only the minimal needed data is exposed
  metadataFields.forEach(field => {
    if (typeof data[field] !== "undefined") {
      result[field] = data[field];
    }
  });

  return result;
}
```

## Building our homepage

Let's build the main page for our blog. It'll read all of our blog names, and get the metadata for each. Then our page will render links for each.

```ts
export const Route = createFileRoute("/")({
  loader: async () => {
    const posts = await getAllPosts();
    return {
      posts,
    };
  },
  component: App,
});
```

Don't let the details of the boilerplate here scare you. Even without ai, the normal TanStack file watcher than runs when you have dev mode running will generate a minimal route object with the right path whenever you add a new file under the routes folder.

Our loader reads our posts. And then we connect up a React component for this route. Let's look at each, in turn. If you're thinking our loader can just call those utility methods we looked at before, well, not so fast. Those methods were reading file contents on disk. That's all well and good, but in TanStack Start, our loaders are isomorphic. When you first browse to your web site, that initial page will run it's loader on the server, and server render your React component. Any subsequent time you browse to any page, that loader will run on the client, in your user's browser. That means there's no way we'd be able to run Node api's to read file contents.

The solution is to use a Server Function. The docs [are here](https://tanstack.com/start/latest/docs/framework/react/guide/server-functions), but the short version is that a TanStack Server Function is a function you define which always runs only on the server. If you call a server function from a server-only location, like an api endpoint, another server function, or even a route loader than's running on the server, then TanStack will simply invoke it. And if you call a Server Function from the client, then TanStack will do the legwork of firing off the correct network request.

The call to

```ts
const posts = await getAllPosts();
```

above is a Server Function. Let's look at its definition now

```ts
const getAllPosts = createServerFn().handler(async () => {
  const postContentLookup = getAllBlogPosts();

  const blogPosts = Object.entries(postContentLookup).map(([slug, content]) => getPostMetadata(slug, content));

  const allPosts: PostMetadata[] = blogPosts
    // sort posts by date in descending order
    .sort((post1, post2) => (post1.date > post2.date ? -1 : 1));
  return allPosts;
});
```

We get all of the posts on disk, and then for each, read the metadata. This is a server function, so it will always, only ever run on the server, no matter where the route's loader is running.

### Rendering the blog links

We won't show the entirety of our route's component, but we read the data from the loader

```ts
function App() {
  const { posts } = Route.useLoaderData();
```

and then later loop it, and emit links for each blog post.

```tsx
<div>
  {posts.map(post => (
    <div key={post.title} className="blog-list-item mb-8">
      <h1 className="leading-none text-2xl font-bold">
        <Link to={`/blog/$slug`} params={{ slug: post.slug }}>
          {post.title}
        </Link>
      </h1>
      <small className="text-sm italic">
        <DateFormatter dateString={post.date}></DateFormatter>
      </small>
      <p className="mt-1.5">{post.description}</p>
    </div>
  ))}
</div>
```

and it works

![Rendering content](/tanstack-blog-post/img2.png)

## Rendering each blog post

Let's get a route created to render an individual blog post. As the `<Link>` component from the homepage implied, we want our url's of the form `/blog/title-of-post`. Obviously `title-of-post` is dynamic, so we'll need a route variable. In TanStack, we do this by first creating a folder called `blog` inside of our `routes` folder, and then inside of that, we create a `$slug.tsx` file. As before, the TanStack file watcher will scaffold a minimal route for us.

```tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/blog/$slug")({
  component: RouteComponent,
});

function RouteComponent() {
  return <div>Hello "/junk/$slug"!</div>;
}
```

Let's fill it out with some details

```tsx
export const Route = createFileRoute("/blog/$slug")({
  loader: async ({ params }) => {
    return await getPostContent({ data: { slug: params.slug } });
  },
  head: ({ params }) => {
    return {
      meta: [
        {
          title: `${params.slug} | Adam Rackis's blog`,
        },
      ],
    };
  },
  component: RouteComponent,
});
```

We add a loader that again makes a call to a Server Function we'll create in a moment. The loader takes a params object we can destructure, which contains the value of our path parameter, which we named `$slug` by virtue of naming our route `$slug.tsx`.

Then we have a `head` function which allows us to set a title for this page (among other things), and like the loader, allows us access to the path params.

Now let's look at our server function that grabs our post's content, for whatever slug we have in our url.

```ts
export const getPostContent = createServerFn()
  .inputValidator((data: { slug: string }) => data)
  .handler(async ({ data }) => {
    const postContentLookup = getAllBlogPosts();

    if (!postContentLookup[data.slug]) {
      throw new Error(`Post not found: ${data.slug}`);
    }

    const post = await getPost(data.slug, postContentLookup[data.slug]);

    return { post };
  });
```

We get the entire list of all blog posts, and verify the one we want is in there. If it is, we call `getPost` and return the result. Let's take a look at `getPost` now

```ts
export async function getPost(slug: string, fileContents: string): Promise<Post> {
  const { data, content: markdownContent } = matter(fileContents);
  const content = await markdownToHtml(markdownContent);

  const result: Post = {
    slug,
    content,
  } as Post;

  // Ensure only the minimal needed data is exposed
  postFields.forEach(field => {
    if (typeof data[field] !== "undefined") {
      result[field] = data[field];
    }
  });

  return result;
}
```

The real work happens in `markdownToHtml` which converts our markdown to html.

I decided to use markdown-it along with Shiki, but there's endless options out there. Here's what it looks like.

```ts
import Shiki from "@shikijs/markdown-it";
import MarkdownIt from "markdown-it";

const markdownIt = MarkdownIt({
  html: true,
}).use(
  await Shiki({
    themes: {
      light: "dark-plus",
      dark: "dark-plus",
    },
    transformers: [
      {
        name: "line-numbers-pre",
        preprocess: (_: string, options: any) => {
          if (options?.meta?.__raw?.includes("line-numbers")) {
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

export default async function markdownToHtml(markdown: string) {
  return markdownIt.render(markdown);
}
```

The vast majority was for a custom transformer that allows this in the markdown

````
```sql line-numbers
SELECT id, SUM(amount)
FROM some_table st
JOIN other_table ot
ON st.id = ot.id
WHERE active = true
GROUP BY ot.id
```
````

which then adds a `data-linenumbers` attribute to the pre element

```html
<pre data-linenumbers=""
```

which allows me to render line numbers via a css counter

```css
pre[data-linenumbers] code {
  counter-reset: step;
  counter-increment: step 0;
}

pre[data-linenumbers] code .line::before {
  content: counter(step);
  counter-increment: step;
  width: 1rem;
  margin-right: 1rem;
  display: inline-block;
  text-align: right;
  color: rgba(115, 138, 148, 0.4);
}
```

I previously blogged about css counters [here](https://frontendmasters.com/blog/css-counters-in-action/), and of course the complete code for this sample blog is on GitHub [here](https://github.com/arackaf/tanstack-blog-blog-post).

And now we can see our post

![Post content](/tanstack-blog-post/img3.png)

And our line numbers work

![Line numbers](/tanstack-blog-post/img4.png)

## Concluding thoughts

Happy Coding!
