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

The app is contrived, but we'll use it to show Router's capabilities, often with silly or contrived use cases. The goal is to show how Router works, not build any kind of actual task management app.

## But what about SSR

As we said above, Router is essentially a client-side framework; in theory there are hooks to get SSR working, but they're very much DIY. If this disappoints you, I'd urge just a bit of patience. TanStack Start, which is currently in Beta, is a new project that, for all intents and purposes, adds SSR capabilities to the very same TanStack Router we'll be talking about. What makes me especially excited about Start is that it adds these server-side capabilities in a very non-intrusive way, which does not change or invalidate anything we'll be talking about in this post (or talked about in my last post on Router, linked above). If that's not entirely clear and you'd like to learn more, stay tuned for my future post on TanStack Start.

## The plan

As we said above, TanStack Router is an entire application framework. You could teach an entire course on it, and indeed there's no shortage of YouTube videos out there. This blog will turn into a book if we try to cover each and every option in depth, so we'll cover the relevant features, and show code snippets where helpful. But refer to the [docs](https://tanstack.com/router/latest/docs/framework/react/overview) for details, or of course the [repo for this post](https://github.com/arackaf/tanstack-router-loader-demo) to see the examples described here, in their entirety.

## Starting at the top: context

When we create our router, we can give it some "context." This is basically global state. For our project, we'll pass in our queryClient for react-query (which we'll be using a little later). Passing the context in is simple enough

```ts
const router = createRouter({ routeTree, context: { queryClient } });
```

and then to make sure Router integrates what we put on context into the static types, we create our root route like this

```ts
export const Route = createRootRouteWithContext<MyRouterContext>()({
  component: Root,
});
```

This context will be available to all routes in the tree, inside api methods like `loader`, which we'll get to shortly.

### Adding to context

Context can change. We set up truly global context when we start Router up at our application's root, but different locations in the route tree to add new things to context, which will be visible from there downward in the tree. There's two places for this, the `beforeLoad` function, and the `context` function. Yes, route's can take a context _function_ which modifies the route tree's context value.

#### beforeLoad

`beforeLoad` runs always, on each active route, anytime the url changes in any way. This is a good place to check preconditions and redirect. If you return a value from here, that value will be merged into the router's context, and visible from that route, downward. This function **blocks** all loaders from running, so be **extremely careful** what you do in here. Data loading should generally be avoided unless absolutely needed, since any loaders will wait until this function is complete, potentially creating waterfalls.

Here's a good example of what to avoid, with an opportunity to see why. This before load fetches the current user, and places it into context, and doing a redirect if there is no user.

```ts
  async beforeLoad({}) {
    const user = await getCurrentUser();
    if (!user) {
      throw redirect({
        to: "/login",
      });
    }
    document.cookie = `user=${user.id};path=/;max-age=31536000`;

    return { user };
  },
```

We'll be lookig at some data loading in a bit, and measure what starts when. You can go into the `getCurrentUser` function and uncomment the artificial delay in there, and see it block everything down the line. This is especially obvious if you're running Router's dev tools. You'll see this path block, and only once ready, allow all loaders below to execute.

But this is a good enough example to show how this works. The `user` object is now in context, visible to routes beneath it.

**NOTE**

```
A more realistic example would probably *just* check for a logged in cookie, and optimistically assume the user is logged in, and rely on network calls we do in the loader's to detect a logged-out user, and redirect accordingly. And to make things even more realistic, those loaders for the initial render would run on the server, and figure out if a user is actually logged out before we show the user *anything*; but that will wait for a future post on TanStack Start.

What we have is sufficient to show how the `beforeLoad` callback works.
```

#### Context (function)

There's also a context `function` we can provide routes. This is a non-async function, that also gives us an opportunity to add to context. But it runs much more conservatively. This function only runs when the url change in a way that's relevant to _that route_. So for a route of, say, `app/epics/$epicId`, the context function will re-run when the epicId param change. This might seem strange, but we'll put this callback to good use later when we start using react-query, and put some query options into context from here, for re-use between the loader (to prefetch queries), and our components (to actually fetch the queries, using React hooks).

For now, here's some code in our root route to mark the time for when the initial render happens, so we can compare that to the timestamp of when various queries run in our tree. This will help us see, and fix network waterfalls.

```ts
  context({ location }) {
    const timeStarted = +new Date();
    console.log("");
    console.log("Fresh navigation to", location.href);
    console.log("------------------------------------------------------------------------------------");

    return { timestarted: timeStarted };
  },
```

This code is in our root route, so it will never re-run, since there's no path parameters the root route depends on.

Now everywhere in our route tree will have a `timestarted` value that we can use to detect any delays from data fetches in our tree.

## Wrapping up
