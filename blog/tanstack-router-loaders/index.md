---
title: Loading Data with TanStack Router
date: "2024-11-12T10:00:00.000Z"
description: A deep dive into various ways of loading, and mutating data with TanStack Router
---

TanStack Router is one of the most exciting projects in the web development ecosystem, which doesn't get nearly enough attention. It's a fully fledged client-side application framework that supports routing with all the advanced use cases you'd expect, nested layouts, and hooks for loading data. Best of all, it does all of this with deep type safety.

I wrote about Router previously [here](https://frontendmasters.com/blog/introducing-tanstack-router/). That post covered just the routing, url and query parameters, along with the type safety we mentioned above.

This post is all about data loading. We'll cover the built in hooks Router ships with to load, and invalidate data. Then we'll cover how easily TanStack Query (also known as react-query) integrates, and see what the tradeoffs of each are.

The code for everything we're covering is [here](https://github.com/arackaf/tanstack-router-loader-demo). As before, I'm building an extremely austere, imaginary Jira knockoff. There's nothing useful in that repo beyond the bare minimum needed for us to take a close look at how data loading works.

The app does load actual data via SQLite, along with some forced delays, so we can more clearly see (and fix) network waterfalls. If you want to run the project, clone it, run `npm i`, and then open **two** terminals. In the first, run `npm run server`, which will create the SQLite database, and seed it with data, and set up the api endpoints to fetch, and update data; in the second, run `npm run dev` to start the main project, which will be on `http://localhost:5173/`. There is some (extremely basic) features to edit data. If at any point you want to completely reset the data, just reset the server task in your terminal.

## But what about SSR

As we said above, Router is essentially a client-side framework; in theory there are hooks to get SSR working, but they're very much DIY. If this disappoints you, I'd urge just a bit of patience. TanStack Start, which is currently in Beta, is a new project that, for all intents and purposes, adds SSR capabilities to the very same TanStack Router we'll be talking about. What makes me especially excited about Start is that it adds these server-side capabilities in a very non-intrusive way, which does not change or invalidate anything we'll be talking about in this post (or talked about in my last post on Router, linked above). If that's not entirely clear and you'd like to learn more, stay tuned for my future post on TanStack Start.

## Getting Started

## Wrapping up