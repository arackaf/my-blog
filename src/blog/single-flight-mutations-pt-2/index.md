---
title: "Single Flight Mutations in TanStack Start - Part 2"
date: "2026-01-09T10:00:00.000Z"
description: Implementing single-flight mutations using TanStack Start, and Query.
---

In part 1 of this post we talked about how single flight mutations allow you to update some data, and also re-fetch updated payloads for the UI in just 1 roundtrip across the network. We implemented a trivial solution for this, which is to say that we threw caution and coupling to the wind, and just re-fetched some data in the server function we had for updating data. This worked fine, but it was hardly scalable or flexible.

In this post we'll accomplish the same thing in a much better way. We'll define some refetching middleware that we can simply attach to any server function we want. The middleware will allow us to specify, via react-query keys, which data we want re-fetched, and it'll handle everything from there.

We'll start simple, and keep on adding features and flexibility. Things will get a bit complex by the end, but please don't think you need to use everything we'll talk about, here. In fact, for the vast majority of apps, single flight mutations probably won't matter at all. And don't be fooled: simply re-fetching some data in a server function might be good enough for a lot of smaller apps as well.

But in going through all of this we'll get to see some really cool TanStack, and even TypeScript features. Even if you never use what we go over for single flight mutations, there's a good chance this content will come in handy for something else.

## Our first middleware

TanStack Query already has a wonderful system of hierarchical keys. Wouldn't it be great if we could just have our middleware receive the query keys of what we want to refetch, and have it just ... work? Have the middleware figure out _what_ to refetch does seem tricky, at first. Sure, our queries have all been simple calls (by design) to server functions. But we can't pass a server function up to the server; functions are not serializable. How could they be? You can send strings and numbers (and booleans) across the wire, serialized as json, but sending a function (which can have with state, close over context, etc) makes no sense.

_Unless_ they're TanStack Start server functions, that is. It turns out the incredible engineers behind this project customized their serialization engine to support server functions. To be clear, you can send a server function to the server, from the client, and it will work fine (under the cover server functions have an internal id; TanStack picks this up, sends the id, and then de-serializes the id on the other end).

To make this even easier, why don't we just attach the server function (and argument it takes) right in to the query options we already have defined. Then our middleware can take the query keys we want re-fetched, look up the query from TanStack Query internals (which we'll dive into) and just make everything work.

### Let's get started

First,

Next, we'll import some goodies

```ts
import { createMiddleware, getRouterInstance } from "@tanstack/react-start";
import { QueryClient, QueryKey, partialMatchKey } from "@tanstack/react-query";
```

Next, let's update our query options for our epics list query (the main list of epics)

```ts
export const epicsQueryOptions = (page: number) => {
  return queryOptions({
    queryKey: ["epics", "list", page],
    queryFn: async () => {
      const result = await getEpicsList({ data: page });
      return result;
    },
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 5,
    meta: {
      __revalidate: {
        serverFn: getEpicsList,
        arg: page,
      },
    },
  });
};
```

Note the new meta section. This allows us to add any random ... metadata that we want, to our query. Here we send over a reference to the `getEpicsList` server function, and the arg it takes. If this duplication makes you uneasy, stay tuned. We'll also update the summary query (for the counts) the same way, though that's not shown here.

Let's build this middleware piece by piece

```ts
// the server function and args are all any, for now, to keep things simple
// we'll see how to type them in a bit
type RevalidationPayload = {
  refetch: {
    key: QueryKey;
    fn: any;
    arg: any;
  }[];
};

type RefetchMiddlewareConfig = {
  refetch: QueryKey[];
};

export const refetchMiddleware = createMiddleware({ type: "function" })
  .inputValidator((config?: RefetchMiddlewareConfig) => config)
  .client(async ({ next, data }) => {
    const { refetch = [] } = data ?? {};
```

We define the input to the middleware. The middleware input we define here will automatically get _merged_ with whatever input is defined on whatever server function this middleware winds up attached to.

We define our input as optional (`config?`) since it's entirely possible we might want to call our server function and simply not refetch anything.

Now we start our client callback. This runs directly in our browser. We pull the array of query keys we want refetched.

```ts
const { refetch = [] } = data ?? {};
```

Now let's get our `queryClient`, and the cache attached to it. Then let's define the payload we want to send to the server callback of our middleware, which will do the actual refetching.

If you've never touched TanStack's middleware before and are feeling overwhelmed, my [middleware post](https://frontendmasters.com/blog/introducing-tanstack-start-middleware/) might be a good introduction.

```ts
const router = await getRouterInstance();
const queryClient: QueryClient = router.options.context.queryClient;
const cache = queryClient.getQueryCache();

const revalidate: RevalidationPayload = {
  refetch: [],
};
```

Our `queryClient` is already attached to the main TanStack router context, so we can get the router, and just grab it.

Remember before when we added that \_\_revalidate payload to our query options, with the server function, and arg? Let's look in our query cache for each key, and retrieve the query options for them.

```ts
refetch.forEach((key: QueryKey) => {
  const entry = cache.find({ queryKey: key, exact: true });
  if (!entry) return;

  const revalidatePayload: any = entry?.options?.meta?.__revalidate ?? null;

  if (revalidatePayload) {
    revalidate.refetch.push({
      key,
      fn: revalidatePayload.serverFn,
      arg: revalidatePayload.arg,
    });
  }
});
```

This check

```ts
if (!entry) return;
```

protects us from refetches being requested for queries that don't exist. If that happens, just skip to the next one. We have no way to refetch it, if we don't have the serverFn.

Naturally you could expand the input to this middleware and send up a different payload of query keys, along with the actual refetching payload (including server function and arg) for queries you absolutely want run, even if they haven't yet been requested. Perhaps you're planning on redirecting after the mutation, and you want that new page's data prefetched. We won't implement that here, but it's just a variation on this same theme. These pieces are all very composable, so build whatever you happen to need!

And then this code grabs that meta object, and puts the properties onto the payload we'll send to the server.

```ts
const revalidatePayload: any = entry?.options?.meta?.__revalidate ?? null;

if (revalidatePayload) {
  revalidate.refetch.push({
    key,
    fn: revalidatePayload.serverFn,
    arg: revalidatePayload.arg,
  });
}
```

NOTE:

Try not to let the various `any`'s bother you; I'm omitting some type definitions that would have been straightforward to define, in order to help prevent this long post from getting even longer.

calling `next` triggers the actual invocation of the server function (and any other middlewares in the chain). The `sendContext` arg allows us to send data _from_ the client, _up to_ the server. And naturally the server is allowed to call `next` with a `sendContext` payload that sends data back to the client.

```ts
const result = await next({
  sendContext: {
    revalidate,
  },
});
```

The `result` payload is what comes back from this invocation. The server callback will have sent back a payloads array, with entries containing a key (the query key), and result (the actual data). We'll loop it, and update the query data accordingly

We'll fix the TS error covered up with // @ts-expect-error momentarily.

```ts
// @ts-expect-error
for (const entry of result.context?.payloads ?? []) {
  queryClient.setQueryData(entry.key, entry.result, { updatedAt: Date.now() });
}

return result;
```

### The Server callback

The server callback looks like this, in its entirety.

```ts
.server(async ({ next, context }) => {
  const result = await next({
    sendContext: {
      payloads: [] as any[]
    }
  });

  const allPayloads = context.revalidate.refetch.map(refetchPayload => {
    return {
      key: refetchPayload.key,
      result: refetchPayload.fn({ data: refetchPayload.arg })
    };
  });

  for (const refetchPayload of allPayloads) {
    result.sendContext.payloads.push({
      key: refetchPayload.key,
      result: await refetchPayload.result
    });
  }

  return result;
```

We immediately call `next()`, which runs the actual server function this middleware is attached to. We pass a `payloads` array in `sendContext`. This governs what gets sent _back_ to the client callback (that's how `.client` got the payloads array we just saw it looping through).

Then we run through the revalidate payloads sent up from the client. The client sent them via `sendContext`, and we read them from the context object (_send_ context, get it?). We then call all the server functions, and add to that payloads array.

Here's the entire middleware

```ts
export const refetchMiddleware = createMiddleware({ type: "function" })
  .inputValidator((config?: RefetchMiddlewareConfig) => config)
  .client(async ({ next, data }) => {
    const { refetch = [] } = data ?? {};

    const router = await getRouterInstance();
    const queryClient: QueryClient = router.options.context.queryClient;
    const cache = queryClient.getQueryCache();

    const revalidate: RevalidationPayload = {
      refetch: [],
    };

    refetch.forEach((key: QueryKey) => {
      const entry = cache.find({ queryKey: key, exact: true });
      if (!entry) return;

      const revalidatePayload: any = entry?.options?.meta?.__revalidate ?? null;

      if (revalidatePayload) {
        revalidate.refetch.push({
          key,
          fn: revalidatePayload.serverFn,
          arg: revalidatePayload.arg,
        });
      }
    });

    const result = await next({
      sendContext: {
        revalidate,
      },
    });

    // @ts-expect-error
    for (const entry of result.context?.payloads ?? []) {
      queryClient.setQueryData(entry.key, entry.result, { updatedAt: Date.now() });
    }

    return result;
  })
  .server(async ({ next, context }) => {
    const result = await next({
      sendContext: {
        payloads: [] as any[],
      },
    });

    const allPayloads = context.revalidate.refetch.map(refetchPayload => {
      return {
        key: refetchPayload.key,
        result: refetchPayload.fn({ data: refetchPayload.arg }),
      };
    });

    for (const refetchPayload of allPayloads) {
      result.sendContext.payloads.push({
        key: refetchPayload.key,
        result: await refetchPayload.result,
      });
    }

    return result;
  });
```

## Fixing the TypeScript error

Why is this line invalid?

```ts
// @ts-expect-error
for (const entry of result.context?.payloads ?? []) {
```

This line runs in the .client callback, _after_ we call `next()`. Essentially, we're trying to read properties sent back to the client, from the server (via the `sendContext` payload). This runs, and works properly. But why don't the types line up?

I covered this in my Middleware post linked above, but our server callback can see what gets sent to it from the client, but the reverse is not true. This knowledge just inherently does not go in both directions; the type inference cannot run backwards.

The solution is simple: just break the middleware into two pieces, and make one of them a middleware dependency on the other.

```ts
const prelimRefetchMiddleware = createMiddleware({ type: "function" })
  .inputValidator((config?: RefetchMiddlewareConfig) => config)
  .client(async ({ next, data }) => {
    const { refetch = [] } = data ?? {};

    const router = await getRouterInstance();
    const queryClient: QueryClient = router.options.context.queryClient;

    // same
    // as
    // before

    return await next({
      sendContext: {
        revalidate,
      },
    });

    // those last few lines are removed
  })
  .server(async ({ next, context }) => {
    const result = await next({
      sendContext: {
        payloads: [] as any[],
      },
    });

    // exactly the same as before

    return result;
  });

export const refetchMiddleware = createMiddleware({ type: "function" })
  .middleware([prelimRefetchMiddleware]) // <-------- connect them!
  .client(async ({ next }) => {
    const result = await next();

    const router = await getRouterInstance();
    const queryClient: QueryClient = router.options.context.queryClient;

    // and here's those last few lines we removed from above
    for (const entry of result.context?.payloads ?? []) {
      queryClient.setQueryData(entry.key, entry.result, { updatedAt: Date.now() });
    }

    return result;
  });
```

It's the same as before, except everything in the `.client` callback _after_ the call to `next()` is now in its own middleware. The rest is in a different middleware, which is input to this one. Now when we call `next` in `refetchMiddleware`, TypeScript is able to see the data that's been sent down from the server, since that was done in `prelimRefetchMiddleware`, which is an _input_ to this middleware, which allows TypeScript to fully see the flow of types.

## Wiring it up

Now we can take our server function for updating an epic, remove the refecthes, and add our refetch middleware

```ts
export const updateEpic = createServerFn({ method: "POST" })
  .middleware([refetchMiddleware])
  .inputValidator((obj: { id: number; name: string }) => obj)
  .handler(async ({ data }) => {
    await new Promise(resolve => setTimeout(resolve, 1000 * Math.random()));
    await db.update(epicsTable).set({ name: data.name }).where(eq(epicsTable.id, data.id));
  });
```

now we set it up to call from our component with the `useServerFn` hook, which handles things like errors and redirects automatically

```ts
const runSave = useServerFn(updateEpic);
```

Remember when I said that inputs to middleware are automatically merged with inputs to the underlying server function? We can see that first hand when we call the server function

![SPA](/single-flight-mutations/img8.png)

(unknown[] is the correct type for react-query query keys)

and now we can call it, and specify the queries we want refetched.

```ts
await runSave({
  data: {
    id: epic.id,
    name: newValue,
    refetch: [
      ["epics", "list", 1],
      ["epics", "summary"],
    ],
  },
});
```

When we run it, it works. Both the list of epics, and also the summary list correctly update with our changes, _without_ any new requests in the network tab. When testing single flight mutations, we're not really looking for _something_ to indicate that it worked, but rather a _lack of_ new network requests, for updated data.

## Improving things

Query keys are hierarchical in react-query. You might already be familiar with this. Normally, when updating data, it would be common to do something like

```ts
queryClient.invalidateQueries({ queryKey: ["epics", "list"] });
```

to refetch _any_ queries whose key _starts with_ `["epics", "list"]`. Can we do something similar in our middleware? Ie, just pass in that key prefix, and have it just find, and refetch whatever's there?

Let's do it!

## Concluding thoughts

Single flight mutations are a great tool for speeding up

Happy Coding!
