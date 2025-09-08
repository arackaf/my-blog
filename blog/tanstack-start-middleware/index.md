---
title: Introducing TanStack Start: Middleware
date: "2025-08-20T10:00:00.000Z"
description: An introduction to Middleware in TanStack Start 
---

TanStack Start is one of the most exciting full-stack web development frameworks out there. I've written about it before [here](https://frontendmasters.com/blog/introducing-tanstack-start/).

In essense, TanStack Start takes TanStack Router, which is a superb, strongly-typed client-side JavaScript framework, and adds server-side support. This serves two purposes: it gives you a place to execute server-side code, like database access, rather than having to provide your own server layer. The other main benefit is server-side rendering, or SSR.

This post is all about one particular, especially powerful feature of TanStack Start: Middleware. This post will be a gentle introduction to the feature. We'll build some _very_ rudimentary observability for a toy app. Then, in the second part of this post, we'll really see what Middleware can do when we put it to work to achieve single-flight mutations.

### Why do we need SSR

I covered this in the post above, but SSR will usually improve LCP render performmance over a client-rendered SPA. With SPAs, the server will usually send down an empty shell of a page. The browser will then parse the script files, and fetch all your application components. Those components will then render and, usually, then _request some data_. Only _then_ can you render actual content.

These round trips are neither free nor cheap; SSR allows you to send the initial content down directly, via the _initial_ request. See the post above for some deeper details. This post is all about a particular, especially cool, powerful feature of TanStack Start: Middleware.

## Prelude: Server Functions

Any full-stack web application will need a place to execute code on the server. It could be to do a database query, to update data, to validate a user against your authentication solution, etc. Server functions are documented [here](https://tanstack.com/start/latest/docs/framework/react/server-functions). The quick introduction is that you can define code like this

```ts
import { createServerFn } from "@tanstack/react-start";

export const getServerTime = createServerFn().handler(async () => {
  await new Promise(resolve => setTimeout(resolve, 1000));
  return new Date().toISOString();
});
```

and then call that function from anywhere, to get a value computed on the server. If you call that function from the browser, TanStack will handle making a network request to an internal url containing that server function. And of course if you call it when already on the server, then TanStack will just execute the code.

Naturally you can specify the http verb to connect your server function with, validate inputs, etc. Check out the docs for more info.

## Getting Started

All of my prior posts on TanStack Start, and Router have used the same contrived Jira clone, and this one will be no different. The repo is [here](https://github.com/arackaf/tanstack-start-middleware-blog-post), but the underlying code is the same. If you want to follow along, you can `npm i` and then `npm run dev` and then run the relevant portion of the app at [http://localhost:3000/app/epics?page=1](http://localhost:3000/app/epics?page=1).

The epics section of this app uses server functions for all data, and all updates. We have an overview showing the each epic, along with the count of tasks in it (for those with tasks), a display of how many epics there are in total, and then a pagable list of individual epics the user can view, and edit.

Again, it's contrived, with the intent of providing us a few different data sources, along with mutations that require them to update.

## Our Middleware Use Case

We'll explore middleware by building an extremely rudimentary observability for our little Jira app.

What is observability? It's a hard thing to define in a clear and meaningful way, but if you think of basic logging a caterpillar, then observability would be the beautiful butterfly it matures into. Observability is all about setting up systems that allow you to holistically observe how your engineering system is behaving. High-level actions are assigned a globally unique trace id, with all the various pieces of work that action performs are logged against that same trace id. Then, your observability software will allow you to intelligently introspect that data and discover where your problems are.

I'm no observability expert, so if you'd like to learn more, Charity Majors [co-authored a superb book on this very topic](https://www.honeycomb.io/). She's the co-founder of [Honeycomb IO](https://www.honeycomb.io/), which is a mature observability platform.

We won't be building a mature observability platform here; we'll be putting together some rudimentary logging with trace id's. What we'll be building is not suitable for use in a production software system, but it _will_ be a great way to explore TanStack Start's middleware feature, which is our goal here.

## Parting thoughts

We've barely scratched the surface .

Happy querying!
