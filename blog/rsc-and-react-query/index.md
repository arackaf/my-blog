---
title: Combining RSC with react-query for easy data management
date: "2024-05-21T10:00:00.000Z"
description: An introduction to RSC and react-query
---

React Server Components, or RSC, is one of the most exciting developments in web development. This post provide a brief introduction to them, what their purpose and benefits are, and then show how to pair them with react-query for seemless data management. Let's get started!

## Why RSC?

React Server Components, as the name implies, execute **on the server**. And the server **alone**. To see why this is significant, let's take a whirlwind tour of how web development evolved over the last 10 years or so.

Prior to RSC, JavaScript frameworks (React, Svelte, Vue, Solid, etc) prodivded you with a component model for building your application. These components were capable of _running_ on the server, but only as a synchronous operation for stringifying your components' html, in order to server render your app. Your app would then render in the browser, again, at which point it would become interactive. With this model, the only way to load data was as a side-effect on the client. Waiting until your app reached your user's browser before beginning to laod data was slow, and inefficient.

To solve this inefficiency, meta-frameworks like Next, SvelteKit, Remix, Nuxt, SolidStart, etc were created. These meta-frameworks provided various ways to load data, server-side, with that data being injected, by the meta-framework into your component tree. This code was traditionally non-portable, and a little awkward. You'd have to define some sort of loader function, semantically associated with a given route, asynchronously load data, and then expect it to show up in your component tree based on the rules of whatever meta-framework you're using.

This worked, but it wasn't without issue. The code was meta framework-specific and non-portable. Composition sufferent; where typically components are explicitly pass props by whichever components render them, now there are _implicit_ props passed by the meta-framework, based on what you return from your loader. Lastly, this setup wasn't the most flexible. A given page needs to know what data it needs up front, and request it all from the loader. With client-rendered SPAs we could just render whatever components we need, and let them fetch whatever data they need. This was awful for performance, but amazing for convenience.

RSC bridges that gap and gives us the best of both worlds. We get to _ad hoc_ request whatever data we need from whichever component we're rendering, but have that code execute on the server, without needing to wait for a round trip to the browser. Best of all, RSC also support _streaming_, or more precisely, out-of-order streaming. If some of our data are slow to load, we can send the rest of the page, and _push_ those data down to the browser, from the server, whenever they happen to be ready.

## How do I use them?

At time of writing RSC are mainly only supported in Next.js, although the minimal framework [Waku](https://waku.gg/) also supports it. Remix and TanStack Router are currently working on implementations, so stay tuned, there. I'll show a very brief overview of what they look like in Next; consult those other frameworks when they ship (the ideas will be the same, even if the implementations differ slightly).

In Next, when using the new "app directory" (it's literally a folder called "app" that you define your various routes in), pages, are RSC by default. Any components imported by these pages are also RSC, as well as components imported by those components, and so on. When you're ready to exit server components and switch back to "client components," you put the "use client" pragma at the top of a component. Now that component, and everything that component imports are client components as well. Check the [Next docs](https://nextjs.org/docs/app) for more info.

### How do React Server Components work?

React Server Components are just like regular React Components, but with a few differences. For starters, they can be async functions. The fact that you can await asynchronous operations right in the comopnent makes them well suited for requesting data. Note that asynchronous client components are a thing coming soon to React, so this differentiation won't exist for too long. The other big difference is that these components run _only on_ the server. Client components (ie regular components) run on the server, and then re-run on the client in order to "hydrate." That's how frameworks like Next and Remix have always worked. But server components run only on the server.

Server components have no hydration, and only execute on the server. That means you can do things like connect directly to a database, or use Server-only api's. But it also means there are many things you can't do in RSCs: you cannot use effects or state, you cannot set up event handlers, or use browser-specific api's like Localstorage. If you violate any of those rules you'll get errors.

For a more thorough introduction to RSC, check the Next docs for the app directory, or depending on when you read this, the Remix or TanStack Router docs. But to keep this post a reasonable length, let's keep the details in the docs, and see how we use these tools.

Let's put together a very basic proof of concept demo app with RSC, see how data mutations work, and some of their limitations. We'll then take that same app (still using RSC) and see how it looks with react-query.

## The demo app

As I've done before, let's put together a very basic, and very ugly web page for searching some books, and also updating the titles of them. We'll also show some other data on this page, the various subjects, and tags we have, which in theory we could apply to our books (if this were a real web app, instead of a demo). The point is to show how RSC and react-query work, not make anything useful or beautiful, so temper your expectations :)

![Book page](/rsc-and-react-query/web-page.jpg)
