---
title: Introducing TanStack Start Middleware
date: "2025-10-15T10:00:00.000Z"
description: An introduction to Middleware in TanStack Start
---

TanStack Start is one of the most exciting full-stack web development frameworks I've seen. I've written about it before [here](https://frontendmasters.com/blog/introducing-tanstack-start/).

In essence, TanStack Start takes TanStack Router, a superb, strongly-typed client-side JavaScript framework, and adds server-side support. This serves two purposes: it gives you a place to execute server-side code, like database access, and it enables server-side rendering, or SSR.

This post is all about one particular, especially powerful feature of TanStack Start: Middleware. The elevator pitch for Middleware is that it allows you to execute code in conjunction with your server-side operations, executing code on both the client and the server, both before and after your underlying server-side action, and even passing data between the client and server.

This post will be a gentle introduction to Middleware. We'll build some _very_ rudimentary observability for a toy app. Then, in a future post, we'll really see what Middleware can do when we use it to achieve single-flight mutations.

### Why do we need SSR

I covered this in the post above, but SSR will usually improve LCP render performance over a client-rendered SPA. With SPAs, the server usually sends down an empty shell of a page. The browser then parses the script files, and fetches your application components. Those components then render and, usually, then _request some data_. Only _then_ can you render actual content for your user.

These round trips are neither free nor cheap; SSR allows you to send the initial content down directly, via the _initial_ request, which the user can see _immediately_, without needing those extra round trips. See the post above for some deeper details; this post is all about Middleware.

## Prelude: Server Functions

Any full-stack web application will need a place to execute code on the server. It could be for a database query, to update data, to validate a user against your authentication solution, etc. Server functions are the main mechanism TanStack Start provides for this purpose, and are documented [here](https://tanstack.com/start/latest/docs/framework/react/server-functions). The quick introduction is that you can define code like this

```ts
import { createServerFn } from "@tanstack/react-start";

export const getServerTime = createServerFn().handler(async () => {
  await new Promise(resolve => setTimeout(resolve, 1000));
  return new Date().toISOString();
});
```

and then call that function from _anywhere_ (client or server), to get a value computed on the server. If you call that function from the browser, TanStack will handle making a network request to an internal url containing that server function. And of course if you call it when already on the server, TanStack will just execute the code.

Naturally you can specify the http verb to connect your server function with, validate inputs, etc. Check out the docs for more info.

## Getting Started

All of my prior posts on TanStack Start, and Router used the same contrived Jira clone, and this one will be no different. The repo is [here](https://github.com/arackaf/tanstack-start-middleware-blog-post), but the underlying code is the same. If you want to follow along, you can `npm i` and then `npm run dev` and then run the relevant portion of the app at [http://localhost:3000/app/epics?page=1](http://localhost:3000/app/epics?page=1).

The epics section of this app uses server functions for all data, and all updates. We have an overview showing each epic, along with the count of tasks in it (for those with tasks), a display of how many epics there are in total, and a pageable list of individual epics the user can view, and edit.

Again, it's contrived, with the intent of providing us a few different data sources, along with mutations.

## Our Middleware use case

We'll explore middleware by building a rudimentary observability system for our Jira app.

What is observability? It's a hard thing to define in a clear and meaningful way, but if you think of basic logging as a caterpillar, observability would be the beautiful butterfly it matures into. Observability is about setting up systems that allow you to holistically observe how your application is behaving. High-level actions are assigned a globally unique trace id, and the pieces of work that action performs are logged against that same trace id. Then your observability system will allow you to intelligently introspect that data and discover where your problems or weaknesses are.

I'm no observability expert, so if you'd like to learn more, Charity Majors [co-authored a superb book on this very topic](https://www.honeycomb.io/). She's the co-founder of [Honeycomb IO](https://www.honeycomb.io/), which is a mature observability platform.

We won't be building a mature observability platform here; we'll be putting together some rudimentary logging with trace id's. What we'll be building is not suitable for use in a production software system, but it _will_ be a great way to explore TanStack Start's middleware.

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

Server functions by definition always run on the server, so you can do things like connect to a database, access secrets, etc.

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

declares the middleware. `type: "function"` means that this middleware is intended to run against server "functions" - there's also "request" middleware, which can run against either server functions, or server routes (what other frameworks sometimes call "api" routes). But "function" middleware has some additional powers, which is why we're using them here.

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

```ts
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

with a one second delay before the final client log, since that was the time execution was on the server, with the delay we saw.

Nothing too shocking. The client logs, then sends execution to the server, and then logs again with whatever context came back from the server. Note we use `result.context` to get what the server sent back, rather than the `context` argument that was passed to the `client` callback. This makes sense: that context was created before the server was ever invoked with the `next()` call, and so there's no way for it to magically, mutably update based on whatever happens to get returned from the server. So we just read `result.context` to get what the server sent back.

### The server

Now let's look at what the server console shows.

server before { hello: 'world' }
server after { hello: 'world' }

Nothing too interesting here, either. As we can see, the server's `context` argument does in fact contain what was sent to it from the client.

### When client middleware runs on the server

Don't forget, TanStack Start will server render your initial path. So what happens when a serverFunction executes as a part of that process, with middleware? How can the client middleware possibly run, when there's no client in existence, yet—only a request, currently being executed on the server.

During SSR, client middleware will run on the server. This makes sense: whatever functionality you're building will still work, but the client portion of it will run on the server. As a result, be sure you don't use any browser-only api's like localStorage.

Let's see this in action, but during the SSR run. The prior logs I showed were the result of browsing to a page via navigation. Now I'll just refresh that page, and show the _server_ logs.

```
client before
server before { hello: 'world' }
server after { hello: 'world' }
client after { value: 12 }
```

As before, but now everything on the server, and as before, there's a one second delay while the server is working.

## Building real middleware

Let's build some actual logging middleware, with an observability flair. If you want to look at real observability solutions, please check out [the book](https://www.amazon.com/Observability-Engineering-Achieving-Production-Excellence/dp/1492076449) I mentioned above, or a real Observability solution like Honeycomb. But our focus will be on TanStack middleware, not a robust observability solution.

### The client

Let's start our middleware with our client section. It will record the local time that this middleware began. This will allow us to measure the total end-to-end time that our action took, including server latency.

```ts
export const loggingMiddleware = (name: string) =>
  createMiddleware({ type: "function" })
    .client(async ({ next, context }) => {
      console.log("middleware for", name, "client", context);

      const clientStart = new Date().toISOString();
```

and now let's call the rest of our middleware chain, and our server function.

```ts
const result = await next({
  sendContext: {
    clientStart,
  },
});
```

Once the `await next` completes, we know that everything has finished on the server, and we're back on the client. Let's grab the date and time that everything finished, as well as a logging id that was sent back from the server. With that in hand we'll call `setClientEnd`, which is just a simple server function to update the relevant row in our log table with the clientEnd time.

```ts
const clientEnd = new Date().toISOString();
const loggingId = result.context.loggingId;

await setClientEnd({ data: { id: loggingId, clientEnd } });

return result;
```

For completeness, it looks like this

```ts
export const setClientEnd = createServerFn({ method: "POST" })
  .inputValidator((payload: { id: string; clientEnd: string }) => payload)
  .handler(async ({ data }) => {
    await db.update(actionLog).set({ clientEnd: data.clientEnd }).where(eq(actionLog.id, data.id));
  });
```

### The server

Let's look at our server handler

```ts
    .server(async ({ next, context }) => {
      const traceId = crypto.randomUUID();

      const start = +new Date();

      const result = await next({
        sendContext: {
          loggingId: "" as string
        }
      });
```

We start by creating a traceId. This is the single identifier that represents the entirety of the action the user is performing. It's not a log id. In fact, for real observability systems, there will be many, many log entries against a single traceId, representing all the sub-steps involved in that action.

For now, there'll just be a single log entry, but in a bit we'll have some fun and go a little further ...

Once we have the traceId, we note the start time, and then we call `await next` to finish our work on the server. We add a `loggingId` to the context we'll be sending _back down_ to the client. It'll use this to update the log entry with the clientEnd time, so we can see the total end-to-end network time.

```ts
const end = +new Date();

const id = await addLog({
  data: { actionName: name, clientStart: context.clientStart, traceId: traceId, duration: end - start },
});
result.sendContext.loggingId = id;

return result;
```

Next we get the end time after the work has completed. We add a log entry, and then we update the context we're sending back down to the client (the sendContext) object with the correct loggingId. Recall that the client callback used this to add the clientEnd time.

And then of course we return the result, which then finishes the processing on the server, and allows control to return to the client.

The addLog function is pretty boring; it just inserts a row in our log table with Drizzle.

```ts
export const addLog = createServerFn({ method: "POST" })
  .inputValidator((payload: AddLogPayload) => payload)
  .handler(async ({ data }) => {
    const { actionName, clientStart, traceId, duration } = data;

    const id = crypto.randomUUID();
    await db.insert(actionLog).values({
      id,
      traceId,
      clientStart,
      clientEnd: "",
      actionName,
      actionDuration: duration,
    });

    return id as string;
  });
```

And this code, as written, works.

![Img 1](/tanstack-start-middleware/img1.png)

## The problem

The code above does work, as written. But there's one small problem: we have a TypeScript error.

Here's the entire middleware, as written, with the TS error pasted as a comment above the offending line

```ts
import { createMiddleware } from "@tanstack/react-start";
import { addLog, setClientEnd } from "./logging";

export const loggingMiddleware = (name: string) =>
  createMiddleware({ type: "function" })
    .client(async ({ next, context }) => {
      console.log("middleware for", name, "client", context);

      const clientStart = new Date().toISOString();

      const result = await next({
        sendContext: {
          clientStart,
        },
      });

      const clientEnd = new Date().toISOString();
      // ERROR: 'result.context' is possibly 'undefined'
      const loggingId = result.context.loggingId;

      await setClientEnd({ data: { id: loggingId, clientEnd } });

      return result;
    })
    .server(async ({ next, context }) => {
      const traceId = crypto.randomUUID();

      const start = +new Date();

      const result = await next({
        sendContext: {
          loggingId: "" as string,
        },
      });

      const end = +new Date();

      const id = await addLog({
        data: { actionName: name, clientStart: context.clientStart, traceId: traceId, duration: end - start },
      });
      result.sendContext.loggingId = id;

      return result;
    });
```

Why does TS dislike this line?

```ts
const loggingId = result.context.loggingId;
```

We call it on the client, after we call `await next` and our server does in fact add a loggingId to its `sendContext` object. And it's there. The value is in fact logged.

The problem is a technical one. Our server callback can see the things the client callback added to sendContext. But the client callback is not able to "look ahead" and see what the server callback added to _its_ sendContext object. The solution is simple: split the middleware up.

Here's a version 2 of the same middleware. I've added it to a new loggingMiddlewareV2.ts

I'll post the entirety of it below, but it's the exact same code as before, except all the stuff in the `.client` handler _after_ the call to `await next` has been moved to a second middleware. This new, second middleware that only contains the second half of the `.client` callback then takes the other middleware as its own middleware.

Here's the code:

```ts
import { createMiddleware } from "@tanstack/react-start";
import { addLog, setClientEnd } from "./logging";

const loggingMiddlewarePre = (name: string) =>
  createMiddleware({ type: "function" })
    .client(async ({ next, context }) => {
      console.log("middleware for", name, "client", context);

      const clientStart = new Date().toISOString();

      const result = await next({
        sendContext: {
          clientStart,
        },
      });

      return result;
    })
    .server(async ({ next, context }) => {
      const traceId = crypto.randomUUID();

      const start = +new Date();

      const result = await next({
        sendContext: {
          loggingId: "" as string,
        },
      });

      const end = +new Date();

      const id = await addLog({
        data: { actionName: name, clientStart: context.clientStart, traceId: traceId, duration: end - start },
      });
      result.sendContext.loggingId = id;

      return result;
    });

export const loggingMiddleware = (name: string) =>
  createMiddleware({ type: "function" })
    .middleware([loggingMiddlewarePre(name)])
    .client(async ({ next }) => {
      const result = await next();

      const clientEnd = new Date().toISOString();
      const loggingId = result.context.loggingId;

      await setClientEnd({ data: { id: loggingId, clientEnd } });

      return result;
    });
```

So we export that second middleware. It takes the other one as _its own_ middleware. That runs everything, as before. But now when the `.client` callback calls `await next`, it knows what's in the resulting context object. It knows this because that other middleware is now _input_ to _this_ middleware, and the typings can readily be seen.

## Going deeper

We could end the post here. I don't have anything new to show with respect to TanStack Start. But let's make our observability system just a _little_ bit more realistic, and in the process get to see a cool Node feature that's not talked about enough, and also has the distinction of being the worst named api in software engineering history: asyncLocalStorage.

You'd be forgiven for thinking that asyncLocalStorage was some kind of async version of your browser's localStorage. But no, it's a way to set and maintain context for the entirety of an async operation in Node.

### When server functions call server functions

Let's imagine our `updateEpic` server function also wants to _read_ the epic it just updated. It does this by calling the `getEpic` serverFn. So far so good, but if our `getEpic` serverFn also has logging middleware configured, we really would want it to use the traceId we already created, rather than create its own.

If you think about React context, where you can put some arbitrary state onto an object that can be read by any component down in the tree. Well, Node's asyncLocalStorage allows this same kind of thing, except instead of being read anywhere inside of a component tree, the state we set can be read anywhere within the current async operation.

Note that TanStack Start did have a getContext / setContext set of api's in an earlier beta version, which maintained state for the current, entire _request_, but they were removed. If they wind up being re-added at some point (possibly with a different name) you can of course use them.

Let's start by importing it, and creating an instance

```ts
import { AsyncLocalStorage } from "node:async_hooks";

const asyncLocalStorage = new AsyncLocalStorage();****
```

And now let's create a function for _reading_ the traceId that some middleware _higher up_ in our callstack _might_ have added

```ts
function getExistingTraceId() {
  const store = asyncLocalStorage.getStore() as any;
  return store?.traceId;
}
```

So all that's left now is to, in our middleware, _read_ the traceId that was set already, if any, and create one if not. And then, crucially, use asyncLocalStorage to _set_ our traceId for any other middlewares that will be called during our operation

```ts
    .server(async ({ next, context }) => {
      const priorTraceId = getExistingTraceId();
      const traceId = priorTraceId ?? crypto.randomUUID();

      const start = +new Date();

      const result = await asyncLocalStorage.run({ traceId }, async () => {
        return await next({
          sendContext: {
            loggingId: "" as string
          }
        });
      });
```

The rest of the middleware is the same, and I've saved it in a loggingMiddlewareV3 module. Let's take it for a spin. First, we'll add it to our getEpic serverFn.

```ts
export const getEpic = createServerFn({ method: "GET" })
  .middleware([loggingMiddlewareV3("get epic")])
  .inputValidator((id: string | number) => Number(id))
  .handler(async ({ data }) => {
    const epic = await db.select().from(epicsTable).where(eq(epicsTable.id, data));
    return epic[0];
  });
```

Now let's add it to our `updateEpic`

```ts
export const updateEpic = createServerFn({ method: "POST" })
  .middleware([loggingMiddlewareV3("update epic")])
  .inputValidator((obj: { id: number; name: string }) => obj)
  .handler(async ({ data }) => {
    await new Promise(resolve => setTimeout(resolve, 1000 * Math.random()));
    await db.update(epicsTable).set({ name: data.name }).where(eq(epicsTable.id, data.id));

    const updatedEpic = await getEpic({ data: data.id });
    return updatedEpic;
  });
```

The latter updates our epic, and then _calls_ the other serverFn to read the newly updated epic.

Let's clear our logging table, and then give it a run. I'll edit, and save an individual epic. Opening the log table now shows this

![Img 1](/tanstack-start-middleware/img2.png)

Note there's _three_ log entries. In order to edit the epic, the UI first reads it. That's the first entry. Then the update happens, and then the second read, from the updateEpic serverFn. Crucially, notice how the last two rows, the update and the last read, both share the same traceId!

Obviously our "observability" system is pretty basic right now. The clientStart and clientEnd probably doesn't make much sense for these secondary actions that are all fired off from the server, since there's not really any end-to-end latency. A real observability system would likely have separate, isolate rows just for client-to-server latency measures. But combining everything together made it easier to put something simple together, and showing off TanStack Start Middleware was the real goal, not creating a real observability system.

Besides, we've now seen all the pieces you'd need if you wanted to actually build this into something more realistic: TanStack's middleware gives you everything you need to do anything you can imagine.

## Parting thoughts

We've barely scratched the surface of Middleware. Stay tuned for a future post where we'll push middleware to its limit in order to achieve single-flight mutations.

Happy querying!
