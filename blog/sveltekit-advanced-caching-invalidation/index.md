---
title: Data caching in SvelteKit
date: "2022-12-27T10:00:00.000Z"
description: A deep dive into SvelteKit's features for data loading, caching and invalidation
---

My [previous post](http://todo) covered a broad survey of SvelteKit. We (hopefully) got a decent enough introduction to see what a great tool it is for web development. This post will fork off what we did there, and dive into every developer's favorite topic: caching. So be sure to give my last post a read if you haven't already. The code for this post [is here](https://github.com/arackaf/sveltekit-blog-2-caching), and is deployed [here](https://sveltekit-blog-2-caching.vercel.app/)

This post is all about data handling. We'll add some rudimentary search functionality that will (using built-in SvelteKit features) modify the page's querystring, and re-trigger the page's loader. But, rather than just re-query our (imaginary) database, we'll add some caching, so re-searching prior searches (or using the back button) will show previously retrieved data, quickly, from cache. We'll look at how to control the length of time the cached data stays valid, and more importantly, how to manually invalidate all cached values.

As icing on the cake, we'll look at how we can manually update the data on the current screen after a mutation, while still purging the cache. In other words, we'll see how to modify data on the current screen, have our changes show up immediately, client-side, while still clearing the cache. You might not always (or ever) want to do that, depending on your use case, but we'll see how so you can have that trick if you ever need it.

This will be a longer, more difficult post than most of what I write, since we're covering harder topics. This post essentially show you how to implement common features of popular data utilities like react-query; but instead of pulling in an external library, we'll be using the web platform, and SvelteKit features only. This will absolutely mean a bit more work, and boilerplate at times, compared to what you might be used to with react-query. The upside is that we won't need any external libraries, which will help keep bundle sizes nice and small. If you have different tradeoffs for your project and prefer the nice loader utility like react-query, you'll be happy to know that the Svelte adapter appears to be a [work-in-progress](https://tanstack.com/query/v4/docs/svelte/overview) so keep an eye out for that.

## Setting up

Before we start, let's make a few small changes to the code we had before. This will give us an excuse to see some other SvelteKit features, and more importantly, set us up for success for what we're trying to do.

First, let's move our data loading from our loader in `+page.server.js` to an [api route](https://kit.svelte.dev/docs/routing#server). We'll create a `+server.js` file in `routes/api/todos`, and then add a `GET` function. This means we'll now be able to run fetch requests (using the default GET verb) to the `/api/todos` path. We'll add the same data loading code as before.

```js
import { json } from "@sveltejs/kit";
import { getTodos } from "$lib/data/todoData";

export async function GET({ url, setHeaders, request }) {
  const search = url.searchParams.get("search") || "";

  const todos = await getTodos(search);

  return json(todos);
}
```

Next, let's take the page loader we had, and simply rename the file from `+page.server.js` to `+page.js` (or .ts if you've scaffolded your project to use TypeScript). This changes our loader to be a "universal" loader, rather than a server loader. The docs [explain the difference](https://kit.svelte.dev/docs/load#universal-vs-server), but a universal loader runs on both the server, and also the client. One advantage for us is that the `fetch` call into our new endpoint will (after the initial load) run right from our browser, using the browser's native fetch function. We'll start to add standard http caching in a bit, but for now, we'll just call the endpoint.

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

Yep, forms can post directly to our normal page loaders. Now we can add a search term in the search box, hit enter, and a "search" term will append to the url's querystring, which will re-run our loader, and search our TODOs.

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

Right now, with the cache header on the api endpoint, our very first, server-rendered load of our app (assuming we start at the /list page) will be cached. SvelteKit is smart enough to run the `api/todos` endpoint on the server, see the cache invalidation header, and keep those results cached. If you browse to the /list page as your first render (or just refresh while there), search something, and then go back, you'll see nothing at all in your network tab. SvelteKit's internal state tells it that the initially loaded data is still valid for the next 60 seconds. If you refresh the page however, it _will_ re-query the endpoint fresh (feel free to validate this by adding logging statements, just be sure to look for them in your terminal, not your browser's dev console, since, again that code runs on the _server_).

After that initial load, when you start searching on the page, you should see network requests from your browser, over to the /api/todos list. As you search for things you've already searched for (within the last 60 seconds) the responses should load immediately, since they're cached. Moreover, since this is caching via the browser's native caching, these calls will continue to cache even if you reload the page (unlike the initial server-side load, which always calls the endpoint fresh, even if it did it within the last 60 seconds).

**Note** if you're verifying this with your dev tools window open, make sure you **un-check** the checkbox that disables caching.

![Caching](/sveltekit-advanced-caching-invalidation/img2-caching.jpg)

Obviously data can change anytime, so we need a way to purge this cache manually, which we'll look at next.

## Cache invalidation

Right now, data are cached for 60 seconds. No matter what, after a minute, fresh data will be pulled from our datastore. You might want a shorter, or longer time period, but what happens if you mutate some data, and want to clear all your caches immediately, so your next query will be up to date? The solution is to add a `Vary` header, next to our cache-control header. This will tell our browser to cache responses, but only if the header specified by `Vary` is the same as the one that's cached. Let's see how.

First, in our `+server.js` file, we'll add our Vary header next to our cache-control header

```js
setHeaders({
  "cache-control": "max-age=60",
  Vary: "todos-cache",
});
```

But now we need to _send_ a header of `todos-cache` when we fetch to this endpoint. We can keep values for this header wherever we want. For this post, let's use `localStorage`. We'll go to our loader, and add this

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

But how do we put that value into localStorage? We need an entry point into our entire web app to set this up. And we have just that: our root layout. Layouts are Svelte components, and as such, they have the same `onMount` hook as any other component. Let's pop into our topmost layout, and add this

```js
import { onMount } from "svelte";

onMount(() => {
  localStorage.setItem("todos-cache", +new Date());
});
```

Now as soon as our app loads (hydrates), we'll set our localStorage value, so the right header value shows up, on which our cache will vary.

As you can see, whenever our app loads, we will always set a new value for this header. This means reloading the browser will always clear our cache, and provide the latest data. This seems like a sensible approach, but if for some reason you don't want this, you're free to only set this localStorage value if it doesn't already exist.

Before we move on, let's make one more tweak. We can only send our vary header from the client, so let's only set our cache header if we're on the client. As we've seen, SvelteKit is smart enough to cache api calls when run from the server. But there's (currently) no way to clear those cached values. From my own testing, even manually always sending a different header value that we're Vary'ing on will not clear the cache. I'm not sure if this is by design, but regardless, let's keep it simple, and only rely on browser cache. Anything from the server will always be fresh and un-cached. That means if we load our /list page, search for something, and hit the back button, we'll never get cached values. This doesn't seem terrible to me.

Just for completeness, if you truly cared, and for some reason wanted even your initial page load's data to be cacheable, you can add

```js
export const ssr = false;
```

to your `+page.js` file. This shuts off server-side rendering, and all of its advantages, which means even your initial data will fetch from the browser. We won't pursue this option in this post, but see [the docs](https://kit.svelte.dev/docs/page-options#ssr) for more info. It should also be noted that if you do this, your initial load function call will run before your root layout's onMount, so you'd need to seed your localStorage value somewhere else, probably in the load function itself.

## The implementation

It's all downhill from here; we've done the hard work. We've covered the various web platform primitives we need, as well as where they go. Now let's write some application code and tie it all together.

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

Let's give this a shot. Reload your page, then edit one of the TODOs. You should see the table value update after a moment. If you look in the network tab, you'll see a fetch to the /todos endpoint, which returns your new data. Simple, and works by default.

![Saving](/sveltekit-advanced-caching-invalidation/img3-saved.jpg)

Let's change it up now. Stop, and then restart your dev server to reset all data. Now search for a value, in the search box we added before, _and then hit the back button_. You should be back to the first page. **Now** edit a todo. You should no longer see the value update. What happened? Our network tab should clue us in

![Saving](/sveltekit-advanced-caching-invalidation/img4-saved-with-cached-results.jpg)

After we saved, that fetch went out for our current data. Unfortunately, it was cached, from when we hit the back button. This wasn't a problem the first time since, again, the very first page load runs our loader on the server, and so there's no browser caching available for that first load.

To solve this, let's clear our cache when we submit our form. We'll add this function to our page

```js
function runInvalidate() {
  localStorage.setItem("todos-cache", +new Date());
}
```

and then call it when we submit our form, to save.

```svelte
<form use:enhance on:submit={runInvalidate} method="post" action="?/editTodo"></form>
```

and now things work!

![Saving](/sveltekit-advanced-caching-invalidation/img5-saving-works.jpg)

## Immediate updates

What if we want to avoid that fetch call that happens after we update our todo, and instead, just update the modified todo right on the screen? This isn't just a matter of performance. If you search for "post," and then remove the word "post" from any of the todo's in the list, they'll vanish from the list after the edit, since they're no longer in that page's search results. You could make the UX better with some tasteful animation for the exiting todo, but let's say we wanted to just _not_ re-run that page's load function, but still clear the cache, and also update the modified todo, so the user can see the edit they just made. SvelteKit makes that possible: let's see how!

First, let's make one little change to our loader. Instead of just returning our todos, let's return a [writeblae store](https://svelte.dev/docs#run-time-svelte-store-writable) containing our todos.

```js
return {
  todos: writable(todos),
};
```

Before, we were accessing our todo's on the `$page.data` store, which we do not own, and cannot update. But Svelte lets us return our data in their own store (assuming we're using a universal loader, which we are). We just need to make one more tweak to our /list page. Instead of

```svelte
{#each todos as t}
```

we need to do

```svelte
{#each $todos as t}
```

since todos is itself now a store. Now our data load, as before. But since `todos` is a writeable store, we can update it.

First, let's provide a function to our `use:enhance` attribute.

```svelte
<form
  use:enhance={executeSave}
  on:submit={runInvalidate}
  method="post"
  action="?/editTodo"
>
```

this will run before a submit. Let's write that, next.

```js
function executeSave({ data }) {
  const id = data.get("id");
  const title = data.get("title");

  return async () => {
    todos.update(list =>
      list.map(todo => {
        if (todo.id == id) {
          return Object.assign({}, todo, { title });
        } else {
          return todo;
        }
      })
    );
  };
}
```

This function provides you a data object which has our form data. We _return_ an async function that will run _after_ our edit is done. [The docs](https://kit.svelte.dev/docs/form-actions#progressive-enhancement-use-enhance) explain all of this, but by doing this, we shut off SvelteKit's default form handling, which would have re-run our loader. This is exactly what we want! (we could easily get that default behavior back, as the docs explain).

We now call `update` on our todos array, since it's a store. And that's that. After editing a todo, our changes show up immediately, and our cache is cleared, so if we search, and then navigate back to this page, we'll get fresh data from our loader, which will correctly exclude any updated todo's that were updated.

## An alternate implementation

Using localStorage to hold these cache busting strings is a simple solution, but it's not the only one, and _possibly_ not the best. The main disadvantage, to me, is that the values can only ever be set on the _client_. That means client-side code that starts these mutations will also need code to clear the related cache busting value. It might be nice to have all code limited to server actions, and loaders. One way to achieve that is by storing these cache busting values in a cookie, rather than localStorage. That value can be set on the server, but still read on the client. Let's look at some sample code.

We can create a `+layout.server.js` file at the very, very root of our `routes` folder. This will run on application startup, and is a perfect place to set an initial cookie value.

```js
export async function load({ locals, isDataRequest, cookies }: any) {
  const initialRequest = !isDataRequest;
  if (initialRequest) {
    cookies.set("todos-cache", +new Date(), { path: "/", httpOnly: false });
  }

  // ...
}
```

notice the `isDataRequest` value. Remember, layouts will re-run anytime client-code calls `invalidate()`, or anytime we run a server action (assuming we don't turn off default behavior, as we did above). `isDataRequest` indicates such re-runs, and so we only set the cookie if that's false.

Then in our _server actions_ we can bust the cache with the same code

```js
cookies.set("todos-cache", +new Date(), { path: "/", httpOnly: false });
```

Naturally a helper function might cut down on the boilerplate

```js
export const bustCache = (cookies, name) => {
  cookies.set(name, +new Date(), { path: "/", httpOnly: false });
};
```

Notice the `httpOnly: false` flag. This allows our client code to read these cookie values in `document.cookie`. This would normally be a security concern, but in our case these are meaningless numbers that allow us to cache, or cache bust.

A function to read these values on the client might look like this

```js
export function getCookieLookup(): Record<string, string> {
  if (typeof document !== "object") {
    return {};
  }

  return document.cookie.split("; ").reduce((lookup, v) => {
    const parts = v.split("=");
    lookup[parts[0]] = parts[1];

    return lookup;
  }, {} as any);
}

const getCurrentCookieValue = (name: string) => {
  const cookies = getCookieLookup();
  return cookies[name] ?? "";
};
```

That first cookie parsing function is a bit gross, but we'd only need it once.

### Digging deeper

You can set cookies in any server load function (or server action), not just the root layout. So if some data are only used underneath a single layout, or even a single page, you could set that cookie value there. Moreoever, if you're _not_ doing the trick I showed earlier of manually updating on-screen data, and instead want your loader to just re-run after a mutation, then you could just always set a new cookie value right in that load function, without any check against `isDataRequest`. It'll set initially, and then anytime you run a server action, that page / layout will automatically invalidate, and re-call your loader, re-setting the cache bust string, before your universal loader is called, pulling the new value for the Vary header.

Both options have tradeoffs. I hope you found value in seeing both.

## Wrapping up

This was a long post, but hopefully not overwhelming. We dove into various ways we can cache data when using SvelteKit. Much of this was just a matter of using web platform primitives to add the correct cache, and Vary headers, knowledge of which will serve you in web development in general, beyond just SvelteKit.

Moreover, this is something you absolutely do not need all the time, and arguably, you should only reach for these sort of advanced features when you **actually need them**. If your data store is serving up data quickly and efficiently, and you're not dealing with any kind of scaling problems, please do not bloat your application code with needless complexity doing the things we talked about here. As always, write clear, clean, simple code, and optimize when necessary. The purpose of this post was to provide you those optimization tools for when you truly need them. I hope you enjoyed it.

Happy coding!
