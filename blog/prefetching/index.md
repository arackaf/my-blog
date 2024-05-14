---
title: Prefetching when server loading won't do
date: "2024-05-04T10:00:00.000Z"
description: A guide to prefetching data for faster rendering, when ssr loading doesn't work
---

This is a post about a boring\* topic: loading data.

<small>(\* Just kidding it will be amazing and engaging.)</small>

Not _how_ to load data, but instead we'll take a step back, and look at _where_ to load data. Not in any particular framework, either, this is going to be more broadly about data loading in different web application architectures, and paricularly how that impacts performance.

We'll start with client-rendered sites and talk about some of the negative performance characteristics they may have. Then we'll move on to server-rendered apps, and then to the lesser-known out-of-order streaming model. To wrap up, we'll talk about a surprisingly old, rarely talked about way to effectively load _slow_ data in a server-rendered application. Let's get started!

## Client Rendering

Application metaframeworks like [Next](https://nextjs.org/) and [SvelteKit](https://kit.svelte.dev/) have become incredibly popular. In addition to offering developer conveniences like file system-based routing and scaffolding of API endoints, they also, more importantly, allow you to server render your application.

Why is server rendering so important? Let's take a look at how the world looks with the opposite: client-rendered web applications, commonly referred to as "single page applications" or SPAs. Let's start with a simplified diagram of what a typical request for a page looks like in an SPA.

![SPA request](/prefetch/img1-spa-request.jpg)

The browser makes a request to your site. Let's call it `yoursite.io`. With an SPA, it usually sends down a single, _mostly empty_ HTML page, which has whatever script and style tags needed to run the site. This _shell_ of a page might display your company logo, your static header, your copyright message in the footer, etc. But mostly it exists to load and run JavaScript, which will build the "real" site.

> This is why these sites are called "single page" applications. There's a single web page for the whole app, which runs code on the client to detect URL changes, and request and render whatever new UI is needed.

Back to our diagram. The inital web page was sent back from the web server as HTML. Now what? The browser will parse that HTML and find script tags. These script tags contain our application code, our JavaScript framework, etc. The browser will send requests back to the web server to load _these_ scripts. Once the browser gets them back, it'll parse, and execute them, and in so doing, begin executing your application code.

At this point whatever client-side router you're using (i.e. [react-router](https://reactrouter.com/en/main), [Tanstack Router](https://tanstack.com/router/latest), etc) will render your current page.

But there's no data yet!

So you're probably displaying loading spinners or skeleton screens or the like. To get the data, your client-side code will _now_ make _yet another_ request to your server to fetch whatever data are needed, so you can display your real, finished page to your user. This could be via a plain old `fetch`, [react-query](https://tanstack.com/query/latest/docs/framework/react/overview), or whatever. Those details won't concern us here.

## SSR To The Rescue

There is a pretty clear solution here. The server _already has_ has the URL of the request, so instead of only returning that shell page, it could (should) request the data as well, get the page all ready to go, and send down the complete page.

Somehow.

This is how the web always worked with tools like PHP or asp.net. But when your app is written with a client-side JavaScript framework like React or Svelte, it's surprisingly tricky. These frameworks all have API's for rendering a component tree on the server, so the HTML could be sent down from the server. But if a component in the middle of that component tree needs data, how do you load it on the server, and then somehow inject it where it's needed? And then have the client acknowledge that data, and not re-request it. And of course, once you solve these problems and render your component tree, with data, on the server, you _still_ need to _re-render_ this component tree on the client, so your client-side code, like event handlers and such, start working.

This act of re-rendering the app client side is called _hydration_. Once it's happened, we say that our app is _interactive_. Getting these things right is one of the main benefits modern application meta-frameworks like Next and SvelteKit provide.

Let's take a look at what our request looks like in this server-rendered setup:

![SSR](/prefetch/img2-ssr-request.jpg)

That's _great_. The user sees the full page much, much sooner. Sure, it's not _interactive_ yet, but if you're not shipping down obscene amount of JavaScript, there's a _really_ good chance hydration will finish before the user can manage to click on any buttons.

We won't get into all this, but Google themselves tell you this is much better for SEO as well.

So, what's the catch? Well, what if our data is **slow to load**. Maybe our database is busy. Maybe it's a huge request. Maybe there is a network hiccup. It's not rare.

![Slow SSR request](/prefetch/img3-ssr-slow-request.jpg)

This might be _worse_ than the SPA we started with. Even though we needed multiple round trips to the server to get data, at least we were displaying a shell of a page quickly. Here, the initial request to the server will just hang and wait as long as needed for that data to load on the server, before sending down the full page. To the user, their browser (and your page) could appear unresponsive, and they might just give up and go back.

## Out of Order Streaming

What if we could have the best of all worlds. What if we could server render, like we saw. _But_ if some data are slow to load, we ship the rest of the page, with the data that we have, and let the server _push_ down the remaining data, when ready. This is called streaming, or more precisely, out-of-order streaming (streaming, without the out-of-order part, is a separate, much more limited thing which we won't cover here).

Let's take a hypothetical example:

![Streaming](/prefetch/img4-ooo-streaming-1.jpg)

Now let's pretend the `data abd`, and `data xyz` are slow to load.

![Streaming](/prefetch/img5-ooo-streaming-2.jpg)

With out-of-order streaming we can load the to-do data load on the server, and send the page with just that data down to the user, immediately. The other two pieces of data have not loaded, yet, so our UI will display some manner of loading indicator. When the next piece of data is ready, the server pushes it down:

![Streaming](/prefetch/img6-ooo-streaming-3.jpg)

and again:

![Streaming](/prefetch/img7-ooo-streaming-4.jpg)

### What's the catch?

So does this solve all of our problems? Yes, but... only if the framework you're using supports it. To stream [with Next.js app directory](https://nextjs.org/docs/app/building-your-application/routing/loading-ui-and-streaming) you'll use Suspense components with [RSC](https://react.dev/reference/rsc/server-components). [With SvelteKit](https://kit.svelte.dev/docs/load#streaming-with-promises) you just return a promise from your loader. [Remix supports this too](https://remix.run/docs/en/main/guides/streaming), with an API that's in the process of changing, so check their docs. [SolidStart](https://start.solidjs.com/getting-started/what-is-solidstart) will also support this, but as of writing that entire project is still in beta, so check its docs when it comes out.

Some frameworks do not support this, like [Astro](https://astro.build/) and Next if you're using the legacy `pages` directory.

What if we're using those projects, and we have some dependencies on data which are slow to load? Are we stuck rendering this data in client code, after hydration?

## Prefetching to the rescue

The web platform has a feature called [prefetching](https://caniuse.com/link-rel-prefetch). This lets us add a `<link>` tag to the `<head>` section of our HTML page, with a `rel="prefetch"` attribute, and an `href` attribute of the URL we want to prefetch. We can put service endpoint calls here, so long as they use the GET verb. If we need to pre-fetch data from an endpoint that uses POST, you'll need to proxy it through an endpoint that uses GET. It's worth noting that you can also prefetch with an HTTP header if that's more convenient; see [this post](https://web.dev/articles/codelab-two-ways-to-prefetch) for more information.

When we do this, our page will start pre-fetching our resources as soon as the browser parses the link tag. Since it's in the `<head>`, that means it'll start pre-fetching at the same time our scripts and stylesheets are requested. So we no longer need to wait until our script tags load, parse, and hydrate our app. Now the data we need will start pre-fetching immediately. When hydration does complete, and our application code requests those same endpoints, the browser will be smart enough to serve that data from the _prefetch cache_.

### Let's see prefetching in action

To see pre-fetching in action, we'll use [Astro](https://astro.build/). Astro is a wonderful web framework that doesn't get nearly enough attention. One of the very few things it can't do is out-of-order streaming (for now). But let's see how we can improve life with pre-fetching.

The repo for the code I'll be showing is [here](https://github.com/arackaf/prefetch-blog-post-astro). It's not deployed anywhere, for fear of this blog posting getting popular, and me getting a big bill from Vercel. But the project has no external dependencies, so you can clone, install, and run locally. You could also deploy this to Vercel yourself if you really want to see it in action.

I whipped up a very basic, very ugly web page that hits some endpoints to pull down a hypothetical list of books, and some metadata about the library, which renders the books once ready. It looks like this:

![Network diagram](/prefetch/img7a-book-list.jpg)

The endpoints return static data, which is why there's no external dependencies. I added a manual delay of 700ms to these endpoints (sometimes you have slow services and there's nothing you can do about it), and I also installed and imported some large JavaScript libraries (d3, framer-motion, and recharts) to make sure hydration would take a moment or two, like with most production applications. And since these endpoints are slow, they're a poor candidate for server fetching.

So let's request them client-side, see the performance of the page, and then add pre-fetching to see how that improves things.

The client-side fetching looks like this:

```tsx
useEffect(() => {
  fetch("/api/books")
    .then(resp => resp.json())
    .then(books => {
      setBooks(books);
    });

  fetch("/api/books-count")
    .then(resp => resp.json())
    .then(booksCountResp => {
      setCount(booksCountResp.count);
    });
}, []);
```

Nothing fancy. Nothing particularly resilient here. Not even any error handling. But perfect for our purposes.

### Network diagram without pre-fetching

Running this project, deployed to Vercel, my network diagram looks like this:

![Network diagram](/prefetch/img8-network-diagram-no-prefetch.jpg)

Notice all of the script and style resources, which need to be requested and processed before our client-side fetches start (on the last two lines).

### Adding pre-fetching

I've added a second page to this project, called `with-prefetch`, which is the same as the index page. Except now, let's see how we can add some `<link>` tags to request these resources sooner.

First, in the root layout, let's add this in the head section

```html
<slot name="head"></slot>
```

this gives us the ability to (but does not require us to) add content to our HTML documents `<head>`. This is exactly what we need. Now we can make a `PrefetchBooks` React component:

```tsx
import type { FC } from "react";

export const PrefetchBooks: FC<{}> = props => {
  return (
    <>
      <link rel="prefetch" href="/api/books" as="fetch" />
      <link rel="prefetch" href="/api/books-count" as="fetch" />
    </>
  );
};
```

Then render it in our prefetching page, like so

```tsx
<PrefetchBooks slot="head" />
```

Note the `slot` attribute on the React component, which tells Astro (not React) where to put this content.

With that, if we run _that_ page, we'll see our link tags in the head

![Network diagram](/prefetch/img9-link-in-head.jpg)

Now let's look at our updated network diagram:

![Network diagram](/prefetch/img10-network-diagram-with-prefetch.jpg)

Notice our endpoint calls now start immediately, on lines 3 and 4. Then later, in the last two lines, we see the real fetches being executed, at which point they just latch onto the prefetch calls already in flight.

Let's put some hard numbers on this. When I ran a webpagetest mobile Lighthouse analysis on the version of this page without the pre-fetch, I got the following.

![Network diagram](/prefetch/img11-lighthouse-before.jpg)

Note the LCP (Largest Contentful Paint) value. That's essentially telling us when the page looks finished to a user. Remember, the Lighthouse test simulates your site in the slowest mobile device imagineable, which is why it's 4.6 seconds.

When I re-run the same test on the pre-fetched version, things improved about a second

![Network diagram](/prefetch/img12-lighthouse-after.jpg)

Definitely much better, but still not _good_; but it never will be until you can get your backend fast. But with some intelligent, targetted pre-fetching, you can at least improve things.

## Parting thoughts

I hope this post was useful. Hopefully all of your back-end data requirements will be forever fast in your developer journies. But when they're not, prefetching resources is a useful tool to keep in your toolbelt.
