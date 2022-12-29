---
title: Advanced data handling with SvelteKit
date: "2022-12-27T10:00:00.000Z"
description: A deep dive into SvelteKit's features for data loading, caching and invalidation
---

My [previous post](http://todo) we covered a very broad survey of SvelteKit. We (hopefully) got a decent introduction to enough of SvelteKit to get the general idea, and see what a great tool it is for web development. This post will pick up where the last post left off in the last one; the code is a fork of what we did in the previous post, so be sure to give that one a read if you haven't already. This code for this post [is here](https://github.com/arackaf/sveltekit-blog-2-caching), and is deployed [here](https://sveltekit-blog-2-caching.vercel.app/)

For this post, we'll look at data handling. We'll add a few more todo's than we had in the last post, and add a rudimentary search functionality. Searching will (using built-in SvelteKit features) modify the page's querystring, which will re-trigger the page's loader. But, rather than re-query our (imaginary) database, we'll look at adding some caching, so re-searching (or using the back button) will show previously retrieved data, quickly. We'll look at how to control the length of time the cached data stays valid, and most importantly, how to manually invalidate all cached values (in other words, after mutating some data).

Lastly, as icing on the cake, we'll look at how we can (if we want to), manually update the data on the current screen after a mutation, while still purging the cache. In other words, we'll see how we can modify data on the current screen, have our changes show up immediately, client-side, while still clearing the cache, so if we search for something new, and then click the back button, we'll get fresh data. You might not always (or ever) want to do that, depending on your use case, but we'll see how, in case you ever need that.

In other words, this post will show you how to implement the common features from popular data loading utilities like react-query, but without any external libraries; we'll be using web platform, and SvelteKit features only.
