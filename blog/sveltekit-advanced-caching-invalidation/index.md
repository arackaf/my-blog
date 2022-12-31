---
title: Advanced data handling with SvelteKit
date: "2022-12-27T10:00:00.000Z"
description: A deep dive into SvelteKit's features for data loading, caching and invalidation
---

My [previous post](http://todo) covered a broad survey of SvelteKit. We (hopefully) got a decent introduction to enough of it to get the general idea, and see what a great tool it is for web development. This post will pick up where we left off; the code is a fork of what we did in the previous post, so be sure to give that one a read if you haven't already. This code for this post [is here](https://github.com/arackaf/sveltekit-blog-2-caching), and is deployed [here](https://sveltekit-blog-2-caching.vercel.app/)

For this post, we'll look at data handling. We'll add a few more todo's than we had before, and a rudimentary search functionality. Searching will (using built-in SvelteKit features) modify the page's querystring, which will re-trigger the page's loader. But, rather than just re-query our (imaginary) database, we'll look at adding some caching, so re-searching prior searches (or using the back button) will show previously retrieved data, quickly, from cache. We'll look at how to control the length of time the cached data stays valid, and more importantly, how to manually invalidate all cached values (for example, after mutating some data).

Lastly, as icing on the cake, we'll look at how we can (if we want to), manually update the data on the current screen after a mutation, while still purging the cache. In other words, we'll see how we can modify data on the current screen, have our changes show up immediately, client-side, while still clearing the cache, so if we search for something new, and then click the back button, we'll get fresh data. You might not always (or ever) want to do that, depending on your use case, but we'll see how, so you can have that trick available if you ever need it.

Basically, this post will show you how to implement many commonly used features of popular data utilities like react-query; but instead of pulling in an external library, we'll be using the web platform, and SvelteKit features only. To set expectations, this will absolutely mean a bit more work, and boilerplate at times, compared to what you might be used to with react-query. The upside is that we won't need any external libraries, which will help keep bundle sizes nice and small. If you have different tradeoffs for your project and prefer the nice loader utility like react-query, you'll be happy to know that the Svelte adapter appears to be a [work-in-progress](https://tanstack.com/query/v4/docs/svelte/overview) so keep your eyes out for that.

## Setting up

Before we start, let's make a few small changes to the code we had before. They'll give us an excuse to see some other SvelteKit features, and more importantly, set us up for success with what we're trying to do.

First, let's move our data loading from our loader in `+page.server.js` over to an [api route](https://kit.svelte.dev/docs/routing#server). We'll create a `+server.js` file in `routes/api/todos`, and then add a `GET` function. This means we'll now be able to run fetch requests (using the default GET verb) to the `/api/todos` path. We'll add the same data loading code as before.

```js
import { json } from "@sveltejs/kit";
import { getTodos } from "$lib/data/todoData";

export async function GET({ url, setHeaders, request }) {
  const search = url.searchParams.get("search") || "";

  const todos = await getTodos(search);

  return json(todos);
}
```

Next, let's take the page loader we had, and simply rename the file from `+page.server.js` to `+page.js` (or .ts if you've scaffolded your project to use TypeScript). This changes our loader to be a "universal" loader, rather than a server loader. The docs explain the difference [here](https://kit.svelte.dev/docs/load#universal-vs-server), but essentially, a universal runs on both the server, and also the client. One advantage for us is that the `fetch` call into our new endpoint will (after the initial load) run right from our browser, using the browser's native fetch function. We'll start to add standard http caching in a bit, but for now, we'll just call the endpoint.

```js
export async function load({ fetch, url, setHeaders }) {
  const search = url.searchParams.get("search") || "";

  const resp = await fetch(`/api/todos?search=${encodeURIComponent(search)}`);

  const todos = await resp.json();

  return {
    todos,
  };
}
```

Let's just add a small feature to our /list page: a simple form

```html
<div class="search-form">
  <form action="/list">
    <label>Search</label>
    <input autofocus name="search" />
  </form>
</div>
```

Yep, forms can post directly to our normal page loaders. Now we can add a search term in the search box, hit enter, and add a "search" term to the url's querystring, which will re-run our loader, and search our TODOs.

![Search form](/sveltekit-advanced-caching-invalidation/img1-search-form.jpg)

As icing on the cake, let's increase the delay in our `todoData.js` file in `/lib/data`. This will make it easy to see when data are, and are not cached as we work through this post.

Remember, the full code for this post is all on github, linked in the intro.

## Basic caching

Let's get started, and add some caching to our `/api/todos` endpoint. We'll go back to our `+server.js` file, and add this

```js
setHeaders({
  "cache-control": "max-age=60",
});
```

which will leave the whole function looking like this

```js
export async function GET({ url, setHeaders, request }) {
  const search = url.searchParams.get("search") || "";

  setHeaders({
    "cache-control": "max-age=60",
  });

  const todos = await getTodos(search);

  return json(todos);
}
```

we'll look at manual invalidation shortly, but this just says to cache these api calls for 60 seconds. Set this to [whatever you want](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control), and depending on your use case, stale-while-revalidate might also be worth looking into.

### What is cached, and where

Right now, with the cache header on the api endpoint, our very first, server-rendered load of our app (assuming we start at the /list page) will be cached. SvelteKit is smart enough to run the `api/todos` endpoint on the server, see the cache invalidation header, and keep those results cached. If you browse to the /list page as your first render (or just refresh while there), search something, and then go back, you'll see nothing at all in your network tab. SvelteKit's internal state tells it that the initially loaded data is still valid for the next 60 seconds. If you refresh the page however, it \*_will_ re-query the endpoint fresh (feel free to validate this by adding logging statements, just be sure to look for them in your network terminal, not your browsers dev console, since, again that code runs on the _server_).

After that initial load, when you start searching on the page, you should see network requests from your browser, over to the /api/todos list. As you search for things you've already searched for (within the last 60 seconds) the responses should load immediately, since they're cached. Moreover, since this is caching via the browser's native caching, these calls will continue to cache even if you reload the page (unlike the initial server-side load, which always calls the endpoint fresh, even if it did it within the last 60 seconds).

![Caching](/sveltekit-advanced-caching-invalidation/img2-caching.jpg)

Obviously data can change anytime, so we need a way to purge this cache manually, which we'll look at next.

## Cache invalidation

Right now,
