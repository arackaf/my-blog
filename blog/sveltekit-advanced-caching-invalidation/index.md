---
title: Data caching in SvelteKit
date: "2022-12-27T10:00:00.000Z"
description: A deep dive into SvelteKit's features for data loading, caching and invalidation
---

My [previous post](http://todo) covered a broad survey of SvelteKit. We (hopefully) got a decent enough introduction to see what a great tool it is for web development. This post will fork off what we did there, and dive into every developer's favorite topic: caching. So be sure to give my last post a read if you haven't already. The code for this post [is here](https://github.com/arackaf/sveltekit-blog-2-caching), and is deployed [here](https://sveltekit-blog-2-caching.vercel.app/)

This post is all about data handling. We'll add some rudimentary search functionality that will (using built-in SvelteKit features) modify the page's querystring, and re-trigger the page's loader. But, rather than just re-query our (imaginary) database, we'll add some caching, so re-searching prior searches (or using the back button) will show previously retrieved data, quickly, from cache. We'll look at how to control the length of time the cached data stays valid, and more importantly, how to manually invalidate all cached values.

As icing on the cake, we'll look at how we can manually update the data on the current screen after a mutation, while still purging the cache. In other words, we'll see how to modify data on the current screen, have our changes show up immediately, client-side, while still clearing the cache. You might not always (or ever) want to do that, depending on your use case, but we'll see how so you can have that trick if you ever need it.

This will be a longer, more difficult post than most of what I write, since we're covering harder topics. This post essentially show you how to implement common features of popular data utilities like react-query; but instead of pulling in an external library, we'll be using the web platform, and SvelteKit features only.

Unfortunately, the web platform's features are a bit lower level, so we'll be doing a bit more work than you might be used to. The upside is, we won't need any external libraries, which will help keep bundle sizes nice and small. If you have different tradeoffs for your project and prefer the nice loader utility like react-query, you'll be happy to know that the Svelte adapter [was just released!](https://tanstack.com/query/v4/docs/svelte/overview)

## Setting up

Before we start, let's make a few small changes to the code we had before. This will give us an excuse to see some other SvelteKit features, and more importantly, set us up for success.

First, let's move our data loading from our loader in `+page.server.js` to an [api route](https://kit.svelte.dev/docs/routing#server). We'll create a `+server.js` file in `routes/api/todos`, and then add a `GET` function. This means we'll now be able to fetch (using the default GET verb) to the `/api/todos` path. We'll add the same data loading code as before.

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

Now let's add a small feature to our `/list` page: a simple form

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

Let's get started, and add some caching to our `/api/todos` endpoint. We'll go back to our `+server.js` file, and add our first cache-control header.

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

We'll look at manual invalidation shortly, but this just says to cache these api calls for 60 seconds. Set this to [whatever you want](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control), and depending on your use case, stale-while-revalidate might also be worth looking into.

And just like that, our queries are caching.

![Caching](/sveltekit-advanced-caching-invalidation/img2-caching.jpg)

**Note** make sure you **un-check** the checkbox that disables caching in dev tools.

Remember, if your initial navigation onto the app is on the list, those search results will be cached internally to SvelteKit, so don't expect to see anything in dev tools when you return to that search.

### What is cached, and where

Our very first, server-rendered load of our app (assuming we start at the /list page) will be fetched on the server. SvelteKit will serialize, and send this data down to our client. What's more, it will observe the cache-control header on the response, and will know to use this cached data, for that endpoint call, within the cache window (60 seconds in this case).

After that initial load, when you start searching on the page, you should see network requests from your browser, to the `/api/todos` list. As you search for things you've already searched for (within the last 60 seconds) the responses should load immediately, since they're cached.

What's especially cool with this approach is that, since this is caching via the browser's native caching, these calls could (depending on how you manage the cache busting we'll be looking at) continue to cache even if you reload the page (unlike the initial server-side load, which always calls the endpoint fresh, even if it did it within the last 60 seconds).

Obviously data can change anytime, so we need a way to purge this cache manually, which we'll look at next.

## Cache invalidation

Right now, data are cached for 60 seconds. No matter what, after a minute, fresh data will be pulled from our datastore. You might want a shorter, or longer time period, but what happens if you mutate some data, and want to clear your cache immediately, so your next query will be up to date? We'll solve this by adding a query-busting value to the url we send to our new `/todos` endpoint.

Let's store this cache busting value in a cookie. That value can be set on the server, but still read on the client. Let's look at some sample code.

We can create a `+layout.server.js` file at the very root of our `routes` folder. This will run on application startup, and is a perfect place to set an initial cookie value.

```js
export function load({ cookies, isDataRequest }) {
  const initialRequest = !isDataRequest;

  const cacheValue = initialRequest ? +new Date() : cookies.get("todos-cache");

  if (initialRequest) {
    cookies.set("todos-cache", cacheValue, { path: "/", httpOnly: false });
  }

  return {
    todosCacheBust: cacheValue,
  };
}
```

You may have noticed the `isDataRequest` value. Remember, layouts will re-run anytime client-code calls `invalidate()`, or anytime we run a server action (assuming we don't turn off default behavior). `isDataRequest` indicates such re-runs, and so we only set the cookie if that's false, otherwise we just send along what's already there.

The `httpOnly: false` flag is also significant. This allows our client code to read these cookie values in `document.cookie`. This would normally be a security concern, but in our case these are meaningless numbers that allow us to cache, or cache bust.

### Reading cache values

Our universal loader is what calls our `/todos` endpoint. This runs on both the server, or the client, and we need to read that cache value we just set up no matter where we are. If we're on the server it's easy: we can call `await parent()` to get the data from parent layouts. But on the client, we'll need to use some gross code to parse document.cookie

```js
export function getCookieLookup() {
  if (typeof document !== "object") {
    return {};
  }

  return document.cookie.split("; ").reduce((lookup, v) => {
    const parts = v.split("=");
    lookup[parts[0]] = parts[1];

    return lookup;
  }, {});
}

const getCurrentCookieValue = name => {
  const cookies = getCookieLookup();
  return cookies[name] ?? "";
};
```

Fortunately, we only need it once.

### Sending out the cache value

But now we need to _send_ this value to our /todos endpoint.

```js
import { getCurrentCookieValue } from "$lib/util/cookieUtils";

export async function load({ fetch, parent, url, setHeaders }) {
  const parentData = await parent();

  const cacheBust = getCurrentCookieValue("todos-cache") || parentData.todosCacheBust;
  const search = url.searchParams.get("search") || "";

  const resp = await fetch(`/api/todos?search=${encodeURIComponent(search)}&cache=${cacheBust}`);
  const todos = await resp.json();

  return {
    todos,
  };
}
```

`getCurrentCookieValue('todos-cache')` has a check in it to see if we're on the client (by checking typeof document), and returns nothing if so, at which point we know we're on the server, and so use the value from our layout.

### Busting the cache

But _how_ do we actually update that cache busting value, when we need to? Since it's stored in a cookie, it's as simple as calling

```js
cookies.set("todos-cache", cacheValue, { path: "/", httpOnly: false });
```

from any server action.

## The implementation

It's all downhill from here; we've done the hard work. We've covered the various web platform primitives we need, as well as where they go. Now let's have some fun and write some application code to tie it all together.

For reasons that'll become clear in a bit, let's start by adding edit functionality into our `/list` page. We'll add this second table row for each todo.

```js
import { enhance } from "$app/forms";
```

```svelte
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
  async editTodo({ request, cookies }) {
    const formData = await request.formData();

    const id = formData.get("id");
    const newTitle = formData.get("title");

    await wait(250);
    updateTodo(id, newTitle);

    cookies.set("todos-cache", +new Date(), { path: "/", httpOnly: false });
  },
};
```

We grab the form data, force a delay, update our todo, and then, most importantly, we clear our cache bust cookie.

Let's give this a shot. Reload your page, then edit one of the TODOs. You should see the table value update after a moment. If you look in the network tab, you'll see a fetch to the /todos endpoint, which returns your new data. Simple, and works by default.

![Saving](/sveltekit-advanced-caching-invalidation/img3-saved.jpg)

## Immediate updates

What if we want to avoid that fetch that happens after we update our todo, and instead, just update the modified todo right on the screen? This isn't just a matter of performance. If you search for "post," and then remove the word "post" from any of the todo's in the list, they'll vanish from the list after the edit, since they're no longer in that page's search results. You could make the UX better with some tasteful animation for the exiting todo, but let's say we wanted to just _not_ re-run that page's load function, but still clear the cache, and also update the modified todo, so the user can see the edit they just made. SvelteKit makes that possible: let's see how!

First, let's make one little change to our loader. Instead of just returning our todos, let's return a [writeblae store](https://svelte.dev/docs#run-time-svelte-store-writable) containing our todos.

```js
return {
  todos: writable(todos),
};
```

Before, we were accessing our todo's on the `data` prop, which we do not own, and cannot update. But Svelte lets us return our data in their own store (assuming we're using a universal loader, which we are). We just need to make one more tweak to our /list page. Instead of

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

We now call `update` on our todos array, since it's a store. And that's that. After editing a todo, our changes show up immediately, and our cache is cleared (as before, since we set a new cookie value in our editTodo form action), so if we search, and then navigate back to this page, we'll get fresh data from our loader, which will correctly exclude any updated todo's that were updated.

### Digging deeper

You can set cookies in any server load function (or server action), not just the root layout. So if some data are only used underneath a single layout, or even a single page, you could set that cookie value there. Moreoever, if you're _not_ doing the trick I just showed, of manually updating on-screen data, and instead want your loader to just re-run after a mutation, then you could just always set a new cookie value right in that load function, without any check against `isDataRequest`. It'll set initially, and then anytime you run a server action, that page / layout will automatically invalidate, and re-call your loader, re-setting the cache bust string, before your universal loader is called.

## Writing a reload function

Let's wrap up by building one last feature: a reload button. Let's give users a button that will clear cache, and then reload the current query.

We'll add a dirt simple form action.

```js
async reloadTodos({ cookies }) {
	cookies.set('todos-cache', +new Date(), { path: '/', httpOnly: false });
},
```

In a real project you probably wouldn't copy paste the same code to set the same cookie in the same way in multiple places, but for this post we'll optimize for simplicity and readability.

Now let's create a form to post to it

```svelte
<form method="POST" action="?/reloadTodos" use:enhance>
  <button>Reload todos</button>
</form>
```

and that ... works.

![Reload](/sveltekit-advanced-caching-invalidation/img6-reload.jpg)

We could call this done, and move on, but let's improve this solution a bit. Let's provide some feedback on the page to tell the user the reload is happening. Also, by default, SvelteKit actions invalidate _everything_. Every layout, page, etc in the current page's hierarchy would reload. There might be some data that's loaded once in the root layout that we don't need invalidated / re-loaded. So let's focus things a bit, and only reload our todos when we call this function.

First, let's pass a function to enhance

```svelte
<form method="POST" action="?/reloadTodos" use:enhance={reloadTodos}>
```

```js
import { enhance } from "$app/forms";
import { invalidate } from "$app/navigation";

let reloading = false;
const reloadTodos = () => {
  reloading = true;

  return async () => {
    invalidate("reload-todos").then(() => {
      reloading = false;
    });
  };
};
```

We're setting a new `reloading` variable to true at the _start_ of this action. And then, in order to override the default behavior of invalidating everything, we return an async function. This function will run when our server action is finished (which just sets a new cookie). Without this async function being returned, SvelteKit would just invalidate everything. Since we're providing this function, it will invalidate nothing, so it's up to us to tell it what to reload. We do this with the `invalidate` function. We call it with a value of `reload-todos`. This function returns a promise, which resolves when the invalidation is complete, at which point we set `reloading` back to false.

Lastly, we need to sync our todo's loader up with this new invalidation value of `reload-todos`. We do that with the `depends` function, in our loader.

```js
export async function load({ fetch, url, setHeaders, depends }) {
	depends('reload-todos');

  // rest is the same
```

and that's that. `depends` and `invalidate` are incredibly useful functions. What's especially cool is that `invalidate` doesn't just take arbitrary values we provide, like we just did. You can also provide a url, which SvelteKit will track, and invalidate any loaders that depend on that url. To that end, if you're wondering whether we could skip the call to `depends`, and just invalidate our `/api/todos` endpoint altogether, you can, but you have to provide the _exact_ url, including the `search` term (and our cache value). So you could either put together the url for the current search, or just match on the pathname, like this

```js
invalidate(url => url.pathname == "/api/todos");
```

Personally I find the solution with `depends` more explicit, and simple. But of course see [the docs](https://kit.svelte.dev/docs/load#invalidation) for more info, and decide for yourself.

If you'd like to see the reload button in action, the code for it is in [this branch](https://github.com/arackaf/sveltekit-blog-2-caching/tree/feature/reload-button).

## Parting thoughts

This was a long post, but hopefully not overwhelming. We dove into various ways we can cache data when using SvelteKit. Much of this was just a matter of using web platform primitives to add the correct cache, and cookie values, knowledge of which will serve you in web development in general, beyond just SvelteKit.

Moreover, this is something you absolutely do not need all the time, and arguably, you should only reach for these sort of advanced features when you **actually need them**. If your data store is serving up data quickly and efficiently, and you're not dealing with any kind of scaling problems, please do not bloat your application code with needless complexity doing the things we talked about here. As always, write clear, clean, simple code, and optimize when necessary. The purpose of this post was to provide you those optimization tools for when you truly need them. I hope you enjoyed it.

Happy coding!
