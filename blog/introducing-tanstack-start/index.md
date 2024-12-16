---
title: Introducing TanStack Start
date: "2024-12-15T20:00:32.169Z"
description: An Introduction to TanStack Start
---

This is a post I've been looking forward to writing for a long time; it's also an incredibly difficult post to write. The best way to think about TanStack Start is that it's nothing more than a server layer atop the TanStack Router that already exists (and is amazing). Not only that, but the thin nature of this server layer means that it completely side-steps the many pain points other web meta-frameworks suffer from.

The primary goal (and challenge) of this post will be to show why a server layer on top of a JavaScript router is valuable, and _why_ TanStack Start's implementation is unique compared to the alternatives, and why that's a good thing. From there, showing how TanStack Start actually works will be relatively straightforward. Wish me luck!

## Why Server Render?

Client-rendered web applications, frequently called "Single Page Applications" or "SPAs" were popular for a long time, and actually still are. "SPA" was never defined precisely, and there's actually some disagreement over what the term means, precisely, but however you define it, the type of app I'm describing is one that's fully client rendered. The server sends down an essentially empty html page, with some script tags that load your framework of choice (React, Vue, Svelte, etc), along with all your application logic.

These apps were always fun to build, and in spite of the hate they often get, they (usually) worked just fine (any kind of software can be bad). But they did suffer from one glaring disadvantge: initial render performance. Remember, the initial render of the page was just an empty shell of your app. This displayed while your script files loaded and executed, and once _those_ scripts run, your application code will almost certainly need to request data before your actual app can display. Under the covers, your app is doing something along the lines of this

![CSR Flow](/introducing-tanstack-start/csr-perf-flow.png)

The initial render of the page, from the web server, renders only an empty shell of your application. Then some scripts are requested, and then parsed and executed once loaded. When those application scripts run, you'll (probably) send some other requests for data. Once _that_ is done, your page will display.

To put it more succintly, with client-rendered web apps, when the user first loads your app, they'll just get a loading spinner. Make your company's logo above it, if they're lucky.

![CSR Flow](/introducing-tanstack-start/csr-user.png)

This is perhaps an overstatement. Users may not even notice the delay caused by these scripts loading (which are likely cached), or hydration, which is probably fast. Depending on the speed of their network, and the type of application, this stuff might not matter much. Maybe.

### SSR

With SSR, the picture looks more like this

![SSR Flow](/introducing-tanstack-start/ssr-render.png)

The server sends down the complete, finished page that the user can see immediately. We do still need to load our scripts and hydrate, so our page can be _interactive_. But that's usually fast, and the user will still have content to see while that happens.

Our hypothetical user looks more like this, now, since the server is responding with a full page the user can see.

![SSR User](/introducing-tanstack-start/ssr-user.png)

### Streaming

We made one implicit assumption above: that our data was fast. If our data was slow to load, our server would be slow to respond. It's bad for the user to be stick looking at a loading spinner, but it's even worse for the user to be looking at a blank screen while the server churns.

As a solution for this, we can use something called "streaming," or "out of order streaming" to be extra precise. Basically, the user still requests all the data, as before. But we tell our server "don't wait for this/these data which are slow - render everything else, now, and send that slow data to the browser when it's ready."

All modern meta-frameworks support this, and our picture now looks like this

![SSR User](/introducing-tanstack-start/ssr-streaming-user.png)

To put a finer point on it, the server does still initiate the request for our slow data _immediately_ on the initial render. It just doesn't block the initial render on it, and instead _pushes down_ the data when ready. We'll look at streaming with Start later in this post.

### Why did we ever do client-rendering?

I'm not here to tear down client-rendered apps. They were, and frankly _still are_ an incredible way to ship deeply interactive user experiences with JavaScript frameworks like React and Vue. The fact of the matter is, server rendering a web app built with React was tricky to get right. You not only needed to server render and send down the html for the url the user requested, but also send down the data for that page, and hydrate everything _just right_ on the client.

It's hard to get right. But here's the thing: **getting this right is the entire purpose of this new generation of meta-frameworks**. Next, Nuxt, Remix, SvelteKit, and SolidStart are some of the more famous examples of these meta-frameworks. And now TanStack Start.

## Why is TanStack Start different?

Why do we need a new meta-framework? There's many possible answers to that question, but I'll give mine. Existing meta-frameworks suffer from some variation on the same issue. They'll provide some server mechanism to load data (on the server). This mechanism is often called a "loader," or in the case of Next, it's just RSCs. Or in Next's pages directory, it's the `getServerSideProps` function. The specifics don't matter. What matters is, for each route, whether the initial load of the page, or client-side navigation via links, some server-side code will run, send down the data, and then render the new page.

### An Impedence Mismatch is Born

Notice the two worlds that exist: the server, where these data loading code will always run, and the client. These frameworks always provide some mechanism to mutate data, and then reload things to show the updated state to your user. Imagine your loader for a page loads some tasks, user settings, and announcements. When the user edits a task, and revalidates, these frameworks will almost always re-run the entire loader, and superfluously re-load the user's announcements and user settings, in addition to tasks, even though tasks are the only thing that changes.

Are there fixes? Of course. Many of these frameworks will allow you to create extra loaders, spread the data loading across them, and revalidate only some of those loaders. Other frameworks encourage you to cache these data. These solutions all work, but come with their own tradeoffs. And remember, they're solutions to a problem that meta-frameworks created, but having server-side loading code for every path in your app.

You might think using a component-level data loading solution like react-query can solve these problems. react-query is great, but it doesn't eliminate these problems. If you have two different pages that each have 5 data sources, of which 4 are shared in common, browsing from the first page to the second will indeed cause the second page to request all 5 pieces of data, even though 4 of them are already present in client-side state. The server is unaware of what happens to exist on the client. The server is not keeping track of what state you have in your browser; in fact the "server" might just be a Lambda function that spins up, satisfies your request, and then dies off.

### Where to, from here?

The root problem is that these meta-frameworks inevitably server-only code running on each path, integrating with long-running client-side state. This leads to conflicts and inefficiencies which need to be managed. There's ways of handling these things, which I touched on above. But it's not a completely clean fit. So what makes TanStack Start different, here?

### Isomorphic loaders

In TanStack, we do have loaders. These are defined by TanStack Router. I wrote a three-part series on Router [here](https://frontendmasters.com/blog/introducing-tanstack-router/). If you haven't read that, and aren't familiar with Router, give it a quick look, since nothing will make sense here without that.

Start takes what we already have with Router, and adds server handling to it. On the initial load, your loader will run on the server, load your data, and send it down. On all subsequent client-side navigations, your loader will run on the client, like it already does. If you like react-query, you'll be happy to know that's integrated too. Your react-query client can run on the server to load, and send data down. On subsequent navigations, these loaders will run on the client, which means your react-query queryClient will have full access to the client-side cache, and will know what does not need to be loaded.

It's honestly such a refreshing, simple, and most importantly, effective pattern that it's hard not being annoyed none of the other frameworks thought of it first. Admittedly, SvelteKit does have universal loaders which are isomorphic in the same way, but without a component-level query library like react-query integrated with the server piece.
