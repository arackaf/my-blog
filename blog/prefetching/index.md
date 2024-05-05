---
title: Prefetching when server loading won't do
date: "2024-05-04T10:00:00.000Z"
description: A guide to prefetching data for faster rendering, when ssr loading doesn't work
---

This is a post about a seemingly boring topic: loading data. But not loading data using any particular framework or library; that's easy enough. For this post I'd like to take a step back, and look at _where_ data are loaded in various kinds of web application architectures, and how that impacts performance. We'll start with client rendered single page applications, or spa's, talk about some of the negative performance characteristics therein. Then we'll move on to server-rendered apps, and then talk about out-of-order streaming. To wrap things up, we'll talk about a surprisingly old, rarely talked about way to effectively load _slow_ data in a server-rendered application which doesn't have access to out-of-order streaming. Let's start!

## Client Rendering

Application metaframeworks like Next and SvelteKit have become incredibly popular recently. In addition to offering developer conveniences like file system-based routing, easy scaffolding of api endoint routes, they also, more importantly, allow you to server render your application.

Why is that so important. Let's take a look at how the world looks with client-rendered web applications, commonly referred to as "single page applications" or spa's. Let's start with a simplified diagram of what a typical request for a page looks like in a SPA.

![SPA request](/prefetch/img1-spa-request.jpg)

The browser makes a request to some webpage, yoursite.io in this case. With a client-rendered site, it usually sends down a single, mostly empty html page, which has whatever script tags and style tags needed to run the app. This shell of a page might display your company logo, your static header, your copyright message in the footer, etc. But mostly it exists to run JavaScript and offer the real app to your users.

Note: this is why these apps are called "single page" applications. There's a single web page for the whole app, which runs code on the client to detect url changes, and request and render whatever new UI is needed.

So back to our diagram. The inital web page was sent back from the web server. Now what? The browser will parse the document, and in doing so encounter script tags. These script tags contain our application code, our JavaScript framework, etc. The browser will send requests back to the web server to load these scripts. Once the browser gets the scripts back, it'll parse, and execute them, and in so doing, begin executing your application code.

At this point whatever client-side router you're using (react-router, Tanstack Router, etc) will render your current page. But there's no data, yet, so you're probably displaying loading spinners somewhere. To get the data you need, your client-side code will _now_ make _yet another_ request to your server to fetch whatever data are needed, so you can display your real, finished page to your user. This could be via a plain old fetch, with react-query, whatever. Those details won't concern us here.

## SSR To The Rescue

Conceptually, the solution should be obvious. The server has the url of the request, so just request the data while you're there, and send it down with the page. Somehow. This is how the web always worked with tools like PHP or asp.net. But when your app is written with a client-side JavaScript framework like React or Svelte, it's surprisingly tricky. These frameworks all have api's for rendering a component tree on the server, so the html could be sent down from the server. But if a component in the middle of that component tree needs data, how do you load it on the server, and then somehow inject it where it's needed? And then have the client acknowledge that data, and not re-request it. And of course, once you solve these problems and render your component tree, with data, on the server, you _still_ need to _re-render_ this component tree on the client, so your client-side code, event handlers and such, and start working.

This act of re-rendering the app client side is called _hydration_. And once it's happened, we say that our app is _interactive_. Getting these things right is one of the main benefits modern application meta-frameworks like Next and SvelteKit provide.

Let's take a look at what our request looks like in this new (old) server rendered world

![SPA request](/prefetch/img2-ssr-request.jpg)

And that's _great_. The user sees the full page much, much sooner. Sure, it's not _interactive_ yet, but if hydration is resonably fast, and you're not shipping down obscene amount of JavaScript, there's a _really_ good chance hydration will finish before the user can manage to click on any buttons.

So, what's the catch? Well, what if our data are slow to load (on the server, or otherwise).

![SPA request](/prefetch/img3-ssr-slow-request.jpg)

If you think about it, depending on circumstances this could be _worse_ than the client rendered page we started with. Even though we needed multiple round trips to the server to get data, at least we were displaying a shell of a page quickly. Here, the initial request to the server will just hang and wait as long as needed for that data to load on the server, before sending down the full page. To the user, their browser (and your page) could appear unresponsive, and they might just give up and go back.

## Out of Order Streaming

What if we could have the best of all worlds. What if we could server render, like we saw. _But_ if some data are slow to load, we ship the rest of the page, with the data that we have, and the server just _pushes_ down the remaining data, when ready. This is called streaming, or more precisely, out-of-order streaming (streaming, without the out-of-order part, is a separate, much more limited thing which we won't cover here)

Let's take a hypothetical example:

![SPA request](/prefetch/img4-ooo-streaming-1.jpg)

Now let's pretend the `data abd`, and `data xyz` are slow to load.

![SPA request](/prefetch/img5-ooo-streaming-2.jpg)

Now the todo data load on the server, and we send the page with that data down to the user, immediately. The other two pieces of data have not loaded, yet, so our UI displays some manner of loading indicator. When the next piece of data is ready, the server pushes it down

![SPA request](/prefetch/img6-ooo-streaming-3.jpg)

and again

![SPA request](/prefetch/img7-ooo-streaming-4.jpg)

### What's the catch?

So does this solve all of our problems? Yes, but ... only if the framework you're using supports it. To stream [with Next.js app directory](https://nextjs.org/docs/app/building-your-application/routing/loading-ui-and-streaming) you'll use Suspense components with RSC. [With SvelteKit](https://kit.svelte.dev/docs/load#streaming-with-promises) you just return a promise from your loader. Remix supports this too, with an api that's in the process of changing, so check their docs. SolidStart will also support this, but as of writing that entire project is still in beta, so check its docs when it comes out.
