---
title: Prefetching when server loading won't do
date: "2024-05-04T10:00:00.000Z"
description: A guide to prefetching data for faster rendering, when ssr loading doesn't work
---

This is a post about a seemingly boring topic: loading data. But not loading data using any particular framework or library; that's easy enough. For this post I'd like to take a step back, and look at _where_ data are loaded in various kinds of web application architectures, and how that impacts performance.

We'll start with client rendered single page applications, or spa's, and talk about some of the negative performance characteristics therein. Then we'll move on to server-rendered apps, and then talk about out-of-order streaming. To wrap things up, we'll talk about a surprisingly old, rarely talked about way to effectively load _slow_ data in a server-rendered application. Let's get started!

## Client Rendering

Application metaframeworks like Next and SvelteKit have become incredibly popular. In addition to offering developer conveniences like file system-based routing, easy scaffolding of api endoints, they also, more importantly, allow you to server render your application.

Why is that so important? Let's take a look at how the world looks with client-rendered web applications, commonly referred to as "single page applications" or spa's. Let's start with a simplified diagram of what a typical request for a page looks like in an SPA.

![SPA request](/prefetch/img1-spa-request.jpg)

The browser makes a request to some webpage, yoursite.io in this case. With a client-rendered site, it usually sends down a single, mostly empty html page, which has whatever script, and style tags needed to run the app. This shell of a page might display your company logo, your static header, your copyright message in the footer, etc. But mostly it exists to run JavaScript and offer the real app to your users.

Note: this is why these apps are called "single page" applications. There's a single web page for the whole app, which runs code on the client to detect url changes, and request and render whatever new UI is needed.

So back to our diagram. The inital web page was sent back from the web server. Now what? The browser will parse the document, and in doing so encounter script tags. These script tags contain our application code, our JavaScript framework, etc. The browser will send requests back to the web server to load these scripts. Once the browser gets the scripts back, it'll parse, and execute them, and in so doing, begin executing your application code.

At this point whatever client-side router you're using (react-router, Tanstack Router, etc) will render your current page. But there's no data, yet, so you're probably displaying loading spinners. To get the data you need, your client-side code will _now_ make _yet another_ request to your server to fetch whatever data are needed, so you can display your real, finished page to your user. This could be via a plain old fetch, with react-query, whatever. Those details won't concern us here.

## SSR To The Rescue

Conceptually, the solution should be obvious. The server has the url of the request, so just request the data while you're there, and send it down with the page. Somehow. This is how the web always worked with tools like PHP or asp.net. But when your app is written with a client-side JavaScript framework like React or Svelte, it's surprisingly tricky. These frameworks all have api's for rendering a component tree on the server, so the html could be sent down from the server. But if a component in the middle of that component tree needs data, how do you load it on the server, and then somehow inject it where it's needed? And then have the client acknowledge that data, and not re-request it. And of course, once you solve these problems and render your component tree, with data, on the server, you _still_ need to _re-render_ this component tree on the client, so your client-side code, event handlers and such, and start working.

This act of re-rendering the app client side is called _hydration_. And once it's happened, we say that our app is _interactive_. Getting these things right is one of the main benefits modern application meta-frameworks like Next and SvelteKit provide.

Let's take a look at what our request looks like in this new (old) server rendered world

![SSR](/prefetch/img2-ssr-request.jpg)

And that's _great_. The user sees the full page much, much sooner. Sure, it's not _interactive_ yet, but if you're not shipping down obscene amount of JavaScript, there's a _really_ good chance hydration will finish before the user can manage to click on any buttons.

So, what's the catch? Well, what if our data are slow to load (on the server, or otherwise).

![Slow ssr request](/prefetch/img3-ssr-slow-request.jpg)

If you think about it, depending on circumstances this could be _worse_ than the client rendered page we started with. Even though we needed multiple round trips to the server to get data, at least we were displaying a shell of a page quickly. Here, the initial request to the server will just hang and wait as long as needed for that data to load on the server, before sending down the full page. To the user, their browser (and your page) could appear unresponsive, and they might just give up and go back.

## Out of Order Streaming

What if we could have the best of all worlds. What if we could server render, like we saw. _But_ if some data are slow to load, we ship the rest of the page, with the data that we have, and let the server _push_ down the remaining data, when ready. This is called streaming, or more precisely, out-of-order streaming (streaming, without the out-of-order part, is a separate, much more limited thing which we won't cover here)

Let's take a hypothetical example:

![Streaming](/prefetch/img4-ooo-streaming-1.jpg)

Now let's pretend the `data abd`, and `data xyz` are slow to load.

![Streaming](/prefetch/img5-ooo-streaming-2.jpg)

With out-of-order streaming we can load the todo data load on the server, and send the page with just that data down to the user, immediately. The other two pieces of data have not loaded, yet, so our UI will display some manner of loading indicator. When the next piece of data is ready, the server pushes it down

![Streaming](/prefetch/img6-ooo-streaming-3.jpg)

and again

![Streaming](/prefetch/img7-ooo-streaming-4.jpg)

### What's the catch?

So does this solve all of our problems? Yes, but ... only if the framework you're using supports it. To stream [with Next.js app directory](https://nextjs.org/docs/app/building-your-application/routing/loading-ui-and-streaming) you'll use Suspense components with RSC. [With SvelteKit](https://kit.svelte.dev/docs/load#streaming-with-promises) you just return a promise from your loader. Remix supports this too, with an api that's in the process of changing, so check their docs. SolidStart will also support this, but as of writing that entire project is still in beta, so check its docs when it comes out.

But Astro, and Next pages directory do not support this. What if we're using those projects, and we have some dependencies on data which are slow to load. Are we stuck rendering this data in client code, after hydration?

## Prefetching to the rescue

The web platform has a feature called [prefetching](https://caniuse.com/link-rel-prefetch). More specifically, the web platform lets us add a `<link>` tag to the head section of our html page, with a `rel="prefetch"` attribute, and an `href` attribute of the url we want to prefetch. We can even put service endpoint calls here, so long as they use the GET verb. If we need to pre-fetch data from an endpoint that uses POST, you'll need to proxy it through an endpoint that uses GET.

When we do this, our page will start pre-fetching our resources as soon as the browser parses the link tag. Since it's in the `<head>`, that means it'll start pre-fetching at the same time our script, and css tags and requested. So we no longer need to wait until our script tags load, parse, and hydrate our app. Now the data we need will start pre-fetching immediately. When hydration does complete, and our application code requests those same endpoints, the browser will be smart enough to serve that data from the _prefetch cache_.

### Let's see prefetching in action

To see pre-fetching in action, we'll use [Astro](https://astro.build/). Astro is a wonderful web framework that doesn't get nearly enough attention. One of the very few things it can't do is out-of-order streaming (for now). But let's see how we can improve life with pre-fetching.

The repo for the code I'll be showing is [here](https://github.com/arackaf/prefetch-blog-post-astro). It's not deployed anywhere, for fear of this blog posting getting popular, and me getting a big bill from Vercel, or similar. BUT the project has no external dependencies, so you can clone, install, and run locally. You could also deploy this to Vercel yourself if you really want to see it in action.

I whipped up a very basic, very ugly web page that hits some endpoints to pull down an hypothetical list of books, and some metadata about the library, which renders the books once ready. The endpoints return static data, so which is why there's no external dependencies. I added a manual delay of 700ms to these endpoints (sometimes you have slow services and there's nothing you can do about it), and I also installed and imported some large JavaScript libraries (d3, framer-mostion, and recharts) to make sure hydration would take a moment or two, like with most production applications. And since these endpoints are slow, they're a poor candidate for server fetching.

So let's by necessity request them client-side, see the performance of the page, and then add pre-fetching to see how that improves things.

### Network diagram without pre-fetching

Running this project, deployed to Vercel, my network diagram looks like this

![Network diagram](/prefetch/img8-network-diagram-no-prefetch.jpg)

Notice all of the js, and css resources which need to be requested, and processed before our client-side fetch is started.

### Adding pre-fetching

I've added a second page to this project, called `with-prefetch`, which is the same as the index page. Except now, let's see how we can add some `<link>` tags to request these resources sooner.

First, in the root layout, let's add this in the head section

```html
<slot name="head"></slot>
```

this gives us the ability to (but does not require us to) add content to our document's head. This is exactly what we need. Now we can make a PrefetchBooks React component, like this

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

and simply render it in our prefetching page, like so

```tsx
<PrefetchBooks slot="head" />
```

note the slot attribute on the React component, which tells Astro (not React) where to put this content.

And with that, if we run that page, we will see our link tags in the head

![Network diagram](/prefetch/img9-link-in-head.jpg)

And now let's look at our updated network diagram

![Network diagram](/prefetch/img10-network-diagram-with-prefetch.jpg)

Notice our endpoint calls now start immediately, on lines 3 and 4. Then later, in the last two lines, we see the real fetches being executed, at which point they just latch onto the pre-fetch calls already in flight.

Let's put some hard numbers on this. When I ran a webpagetest mobile lighthouse analysis on the version of this page without the pre-fetch, I got the following.

![Network diagram](/prefetch/img11-lighthouse-before.jpg)

Note the LCP value: that's largest contentful paint. That's essentially telling us when things are _finished_ rendering. Remember, the lighthouse test simulates your site in the slowest mobile device imagineable, which is why it's 4.6 seconds.

When I re-run the same test on the pre-fetched version, things improved about a second

![Network diagram](/prefetch/img12-lighthouse-after.jpg)

It's still not _good_ but it never will be until you can get your backend fast. But with some intelligent, targetted pre-fetching, you can at least improve things.

## Parting thoughts

I hope this post was useful. Hopefully all of your backend data requirements will be forever fast in your developer journies. But when they're not, prefetching resources is a useful tool to keep in your toolbelt.

Happy coding!
