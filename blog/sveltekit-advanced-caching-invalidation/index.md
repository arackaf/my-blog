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

Let's also increase the delay in our `todoData.js` file in `/lib/data`. This will make it easy to see when data are, and are not cached as we work through this post.

```js
export const wait = async amount => new Promise(res => setTimeout(res, amount ?? 500));
```

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

Right now, data are cached for 60 seconds. No matter what, after a minute, fresh data will be pulled from our datastore. You might want a shorter, or longer time period, but what happens if you mutate some data, and want to clear all your caches immediately, so your next query will be up to date? The solution is to add a `Vary` header, next to our cache-control header. This will tell our browser to cache responses, but only if the header specified by Vary is the same as the one that's cached. Let's see how.

First, in our `+server.js` file, we'll add our Vary header next to our cache-control header

```js
setHeaders({
  "cache-control": "max-age=60",
  Vary: "todos-cache",
});
```

But now we need to _send_ a header of `todos-cache` when we fetch to this endpoint. We can keep values for this header wherever we want. Let's use `localStorage`. we'll go to our loader, and add some code to do so

```js
export async function load({ fetch, url, setHeaders }) {
  const search = url.searchParams.get("search") || "";

  let headers = {};
  if (typeof window === "object") {
    headers["todos-cache"] = localStorage.getItem("todos-cache");
  }

  const resp = await fetch(`/api/todos?search=${encodeURIComponent(search)}`, {
    headers,
  });

  const todos = await resp.json();

  return {
    todos,
  };
}
```

`localStorage` only exists on the client, not the server, so we'll check we're in the right place, and only set it if we are.

But how do we put that value into localStorage? We need an entry point into our entire web app to set this up. And we have just that: our root layout. Layouts are Svelte components, and as such, they have the same `onMount` hook any other component does. Let's pop into our topmost layout, and add this

```js
import { onMount } from "svelte";

onMount(() => {
  localStorage.setItem("todos-cache", +new Date());
});
```

Now as soon as our app loads (hydrates), we'll set our localStorage value, so the right header value shows up, on which our cache will vary.

As you can see, whenever our app loads, we will always set a new value for this header. This means that reloading the browser will always clear our cache, and provide the latest data. This seems like a sensible approach, but if for some reason you don't want this, you're free to only set this localStorage value if it doesn't exist.

Before we move on, let's make one more tweak. We can only send our vary header from the client, so let's only set our cache header if we're on the client. As we've seen, SvelteKit is smart enough to cache api calls when run form the server. But there's no way to clear those cached values. From my own testing, even manually always sending a different header value that we're Vary'ing on will not clear the cache. I'm not sure if this is by design, but regardless, let's keep it simpler, and only rely on browser cache. Anything from the server will always be fresh and un-cached. That means if we load our /list page, search for something, and hit back, we'll never get cached values. This doesn't seem terrible to me.

Just for completeness, if you truly cared, and for some reason wanted even your initial page load's data to be cacheable, you can add

```js
export const ssr = false;
```

to your `+page.js` file. This shuts off server-side rendering, which means even your initial data will fetch from the browser. We won't pursue this option in this post, but see [the docs](https://kit.svelte.dev/docs/page-options#ssr) for more info. It should also be noted that if you do this, your initial load function call will run before your root layout's onMount, so you'd need to seed your localStorage value somewhere else, probably in the load function itself.

## The implementation

It's all downhill from here; we've done all of the hard work, already. We've covered the various web platform primitives we need to, as well as where they go. Now let's write some application code and tie it all together.

For reasons that'll become clear in a bit, let's start by adding edit functionality into our `/list` page. We'll add this second table row for each todo.

```html
<tr>
  <td colspan="4">
    <form use:enhance method="post" action="?/editTodo">
      <input name="id" value="{t.id}" type="hidden" />
      <input name="title" value="{t.title}" />
      <button>Save</button>
    </form>
  </td>
</tr>
```

and of course we'll need to add a form action for our /list page. Actions can only go in .server pages, so we'll add a `+page.server.js` in our /list folder (yes, a `+page.server.js` file can co-exist next to a `+page.js` file).

```js
import { getTodo, updateTodo, wait } from "$lib/data/todoData";

export const actions = {
  async editTodo({ request }) {
    const formData = await request.formData();

    const id = formData.get("id");
    const newTitle = formData.get("title");

    await wait(250);
    updateTodo(id, newTitle);
  },
};
```
