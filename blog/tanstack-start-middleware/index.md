---
title: Introducing TanStack Start Middleware
date: "2025-08-20T10:00:00.000Z"
description: An introduction to Middleware in TanStack Start
---

TanStack Start is one of the most exciting full-stack web development frameworks out there. I've written about it before [here](https://frontendmasters.com/blog/introducing-tanstack-start/).

In essence, TanStack Start takes TanStack Router, which is a superb, strongly-typed client-side JavaScript framework, and adds server-side support. This serves two purposes: it gives you a place to execute server-side code, like database access, rather than having to provide your own server layer. The other main benefit is server-side rendering, or SSR.

This post is all about one particular, especially powerful feature of TanStack Start: Middleware. This post will be a gentle introduction to the feature. We'll build some _very_ rudimentary observability for a toy app. Then, in the second part of this post, we'll really see what Middleware can do when we put it to work to achieve single-flight mutations.

### Why do we need SSR

I covered this in the post above, but SSR will usually improve LCP render performance over a client-rendered SPA. With SPAs, the server will usually send down an empty shell of a page. The browser will then parse the script files, and fetch all your application components. Those components will then render and, usually, then _request some data_. Only _then_ can you render actual content.

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

The epics section of this app uses server functions for all data, and all updates. We have an overview showing the each epic, along with the count of tasks in it (for those with tasks), a display of how many epics there are in total, and then a pageable list of individual epics the user can view, and edit.

Again, it's contrived, with the intent of providing us a few different data sources, along with mutations that require them to update.

## Our Middleware Use Case

We'll explore middleware by building a rudimentary observability system for our Jira app.

What is observability? It's a hard thing to define in a clear and meaningful way, but if you think of basic logging as a caterpillar, then observability would be the beautiful butterfly it matures into. Observability is about setting up systems that allow you to holistically observe how your application is behaving. High-level actions are assigned a globally unique trace id, and the pieces of work that action performs are logged against that same trace id. Then your observability system will allow you to intelligently introspect that data and discover where your problems or weaknesses are.

I'm no observability expert, so if you'd like to learn more, Charity Majors [co-authored a superb book on this very topic](https://www.honeycomb.io/). She's the co-founder of [Honeycomb IO](https://www.honeycomb.io/), which is a mature observability platform.

We won't be building a mature observability platform here; we'll be putting together some rudimentary logging with trace id's. What we'll be building is not suitable for use in a production software system, but it _will_ be a great way to explore TanStack Start's middleware feature, which is our goal here.

## Our first server function

This is a post about middleware, which is applied to server functions. Let's take a very quick look at a server function

```ts
export const getEpicsList = createServerFn({ method: "GET" })
  .validator((page: number) => page)
  .handler(async ({ data }) => {
    const epics = await db
      .select()
      .from(epicsTable)
      .offset((data - 1) * 4)
      .limit(4);
    return epics;
  });
```

This is a simple server function to query our epics. We configure it to use the GET http verb. We specify and potentially validate our input, and then the handler function runs our actual code, which is just a basic query against our SQLite database. This particular code uses Drizzle for the data access, but you can of course use whatever you want.

Server functions by definition will always run on the server, so you can do things like connect to a database, access secrets, etc.

## Our first middleware

Let's add some empty middleware so we can see what it looks like.

```ts
import { createMiddleware } from "@tanstack/react-start";

export const middlewareDemo = createMiddleware({ type: "function" })
  .client(async ({ next, context }) => {
    console.log("client before");

    const result = await next({
      sendContext: {
        hello: "world",
      },
    });

    console.log("client after", result.context);

    return result;
  })
  .server(async ({ next, context }) => {
    console.log("server before", context);

    await new Promise(resolve => setTimeout(resolve, 1000));

    const result = await next({
      sendContext: {
        value: 12,
      },
    });

    console.log("server after", context);

    return result;
  });
```

```ts
export const middlewareDemo = createMiddleware({ type: "function" });
```

declares the middleware. `type: "function"` means that this middleware is intended to run against server "functions" - there's also "request" middleware, which can run against either server functions, or server routes (what other frameworks sometimes call "api" routes). But "function" middleware has some additional powers, which is why we're using it here.

```ts
.client(async ({ next, context }) => {
```

This allows us to run code on the client. Note the arguments: `next` is how we tell TanStack to proceed with the rest of the middlewares in our chain, as well as the underlying server function this middleware is attached to. And `context` holds the mutable "context" of the middleware chain.

```ts
console.log("client before");

const result = await next({
  sendContext: {
    hello: "world",
  },
});

console.log("client after", result.context);
```

We do some logging, then tell TanStack to run the underlying server function (as well as any other middlewares we have in the chain), and then, after everything has run, we log again.

And of course don't forget to return the actual result

```
return result;
```

You can naturally just `return next()` but this allows you to do additional work after the call chain is finished: either modify context, perform logging, etc.

Note the `sendContext` we pass into the call to `next`

```ts
sendContext: {
  hello: "world",
},
```

This allows us to pass data from the client, up to the server. Now this `hello` property will be in the context object on the server.

And now we essentially restart the same process on the server

```ts
.server(async ({ next, context }) => {
    console.log("server before", context);

    await new Promise(resolve => setTimeout(resolve, 1000));

    const result = await next({
      sendContext: {
        value: 12
      }
    });

    console.log("server after", context);

    return result;
```

We do some logging, and inject an artificial delay of one second, to simulate work. Then, as before, we call `next()` which triggers the underlying server function (as well as any other middlewares in the chain), and then return the result.

Note again the `sendContext`

```ts
sendContext: {
  value: 12;
}
```

This allows us to send data from the server, back down to the client.

### Let's run it

I have a server function with this middleware configured

```ts
export const getEpicsList = createServerFn({ method: "GET" })
  .inputValidator((page: number) => page)
  .middleware([middlewareDemo])
  .handler(async ({ data }) => {
    const epics = await db
      .select()
      .from(epicsTable)
      .offset((data - 1) * 4)
      .limit(4);
    return epics;
  });
```

and when we run it, this is what is in the _browser's_ console shows

```
client before
client after {value: 12}
```

_with a one second delay before the final client log, since that was the time execution was on the server, with the delay we saw_

Nothing too shocking. The client logs, then sends execution to the server, and then logs again, with whatever context came back from the server. Note we use `result.context` to get what the server sent back, rather than the `context` argument that was passed to the `client` callback. This makes sense: that context was created before the server was ever invoked with the `next()` call, and so there's no way for it to magically, mutably update based on whatever happens to get returned from the server. So we just read `result.context` to get what the server sent back.

### The server

Now let's look at what the server shows.

server before { hello: 'world' }
server after { hello: 'world' }

Nothing too interesting here, either. As we can see, the server's `context` argument does in fact contain what was sent to it from the client.

### When client middleware runs on the server

Don't forget, TanStack Start will server render your initial path. So what happens when a serverFunction executes as a part of that process, with middleware? How can the client middleware possibly run, since there's no client in existence, yet—only a request, currently being executed on the server: TanStack is not yet running on any browser, since we haven't even sent script tags down to whatever browser requested this url.

During SSR, client middleware will run on the server. This makes sense: whatever functionality you're building will still work, but the client portion of it will run on the server. As a result, be sure you don't use any browser-only api's like localStorage.

Let's see this in action, but during the SSR run. The prior logs I showed were the result of browsing to a page via navigation. Now I'll just refresh that page, and show the _server_ logs.

```
client before
server before { hello: 'world' }
server after { hello: 'world' }
client after { value: 12 }
```

As before, but now everything on the server.

## Let's get started

## Parting thoughts

We've barely scratched the surface of Middleware. Stay tuned for part of 2 of this post, where we'll push middleware to its limit to achieve single-flight mutations.

Happy querying!
