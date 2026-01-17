---
title: "Single Flight Mutations in TanStack Start"
date: "2026-01-09T10:00:00.000Z"
description: Implementing single-flight mutations using TanStack Start, and Query.
---

This is a post about single flight mutations. We'll get into the details of what that means, but the short version is, it's mutating data, and then updating the UI with just ONE round trip to the network.

The beautiful thing about implementing this with TanStack is that we can leverage the tools we already know, and love: TanStack Query (formerly react-query), TanStack Router, and Start.

If you're not familiar with these tools, TanStack Router is a client-only SPA framework, about which I wrote a three-part introduction [here](https://frontendmasters.com/blog/introducing-tanstack-router/). TanStack Start is a server layer for Router that enables things like SSR, api routes and server functions; I wrote an introduction for it [here](https://frontendmasters.com/blog/introducing-tanstack-start/), as well as a post on the middleware feature [here](https://frontendmasters.com/blog/introducing-tanstack-start-middleware/).

I've never written about TanStack Query, but it's one of the most widely used React libraries, and there are tons of resources about it.

## Laying the Groundwork

In my [post on TanStack Start](https://frontendmasters.com/blog/introducing-tanstack-start/) I included this image, which is how client-driven single-page applications (SPAs) almost always behave.

![SPA](/single-flight-mutations/img1.png)

The initial request for whatever URL you're viewing returns an empty skeleton of a page. From there, more networks requests happen to fetch scripts and styles, and most likely some data, which eventually results in your actual content page being rendered.

The network round trips will almost always be the single most expensive thing your web application will do. To look at it another way, there are few things you can do to improve performance as much as _removing_ network roundtrips. And this is why server-side rendering can be so beneficial: it allows us to display content to our users _immediately_, after the initial request is responded to.

I expressed this in the Start post with this image.

![SPA](/single-flight-mutations/img2.png)

Those scripts and styles still have to load for your page to be interactive, but that initial response from the server can immediately display content for the user.

## Why Single Flight Mutations

Let's think about how you'd normally update a piece of data in a web application. You probably make a network request to some sort of `/update` endpoint, along with some sort of post packet for whatever you're trying to change. The endpoint will probably return a success flag, possibly with the actual piece of data you just updated. Your UI will usually then request updated data. You might think that returning the updated piece of data you just changed would obviate this need, but frequently it will not.

Imagine you're looking at a list of todo tasks, and you just edited one of them. Just updating the item on the screen isn't good enough; maybe the edit causes this TODO to not longer even be in this list, depending on your filters. Or perhaps your edit causes this TODO to be in a different location, based on your sort order. Or maybe you just _created_ a _brand new_ todo. In that case, who knows where, or even _if_ this todo will show up in your list, again based on your filters or sorts.

So we re-fetch whatever query produces our list. It usually looks like this

![SPA](/single-flight-mutations/img3.png)

This works, and if we're honest with ourselves, it's usually good enough. But can we do better? We wouldn't be good engineers if we didn't at least _try_. Conceptually we'd like to get something like this

![SPA](/single-flight-mutations/img4.png)

The rest of this post will walk through how we can accomplish this in a scalable, flexible way. We'll be using TanStack Start, Middleware, and TanStack Query (formerly react-query).

## Our app

As with prior posts about TanStack Start and Router, this post will use our cheap, simply, and frankly ugly Jira clone. The repo for it is [here](https://github.com/arackaf/tanstack-start-single-flight-mutations-blog-post). It's a trivial app that runs on an SQLite database. The epics page looks like this

![SPA](/single-flight-mutations/img5.png)

As you can see, zero effort was put into the design. But there's a few sources of data on the screen, which will help us implement single flight mutations: the main list of epics, above that is the count of epics (12), and above that we have a summary list of epics, with the numbers of tasks therein.

This is the page we'll be focusing on for this post. If you're following along at home, you can run the app with `npm run dev` and then visit [http://localhost:3000/app/epics](http://localhost:3000/app/epics).

Our queries, for things like our list of epics and our summary data are driven by react-query. I've put the query options into a helper utilities, like so

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
  });
};
```

This allows me to query data using the normal useQuery or useSuspenseQuery hook

```ts
const { data: epicsData } = useSuspenseQuery(epicsQueryOptions(deferredPage));
```

and also prefetch these queries in TanStack loaders

```ts
  async loader({ context, deps }) {
    const queryClient = context.queryClient;

    queryClient.ensureQueryData(epicsQueryOptions(deps.page));
    queryClient.ensureQueryData(epicsCountQueryOptions());
  },
```

without duplicating code.

As you can see, this query (and all our other queries) are just straight calls to a single server function, with the result passed through. This is a key detail that will come in handy later.

## Simplest possible single flight mutation

Let's implement the simplest possible single flight mutation, and then iterate on it, to make it more and more scalable. Our main epics page has an edit button, which allows for inline editing.

![inline editing](/single-flight-mutations/img6.png)

When we hit save, let's just refetch the list of epics, as well as the epics summary data inside the edit epic server function, and send those new data down. Then the client can update the UI. Let's do it!

Here's the entire server function

```ts
export const updateWithSimpleRefetch = createServerFn({ method: "POST" })
  .inputValidator((obj: { id: number; name: string }) => obj)
  .handler(async ({ data }) => {
    await new Promise(resolve => setTimeout(resolve, 1000 * Math.random()));
    await db.update(epicsTable).set({ name: data.name }).where(eq(epicsTable.id, data.id));

    const [epicsList, epicsSummaryData] = await Promise.all([getEpicsList({ data: 1 }), getEpicsSummary()]);

    return { epicsList, epicsSummaryData };
  });
```

We save our epic, and then just fetch the updated data, from the `getEpicsList`, and `getEpicsSummary` server functions, which we call in parallel with `Promise.all` (a production application would likely have some error handling...)

Now when we call our server function, the data for those queries will be attached to the result. In fact, since we're using server functions, these things will even be statically typed.

![Payloads returned](/single-flight-mutations/img6.png)

### Updating the UI

With updated data for our queries coming back after the save, we just have to insert it back into the UI. TanStack Query makes this simple. We need a reference to the TanStack Query QueryClient

```ts
const queryClient = useQueryClient();
```

and then we can update the query payload for a given query with the `setQueryData` method. It takes the query key, and the data, along with some metadata we can add, to indicate how fresh this data is.

```ts
const handleSaveSimple = async () => {
  const newValue = inputRef.current?.value || "";
  const result = await runSaveSimple({
    data: {
      id: epic.id,
      name: newValue,
    },
  });

  queryClient.setQueryData(["epics", "list", 1], result.epicsList, { updatedAt: Date.now() });
  queryClient.setQueryData(["epics", "summary"], result.epicsSummaryData, { updatedAt: Date.now() });

  setIsEditing(false);
};
```

If hard-coding those query keys feels gross to you, don't forget about those helper utilities we added before

```ts
queryClient.setQueryData(epicsQueryOptions(1).queryKey, result.epicsList, { updatedAt: Date.now() });
queryClient.setQueryData(epicsSummaryQueryOptions().queryKey, result.epicsSummaryData, { updatedAt: Date.now() });
```

## Iterating

Our solution works but it's fragile. It's probably not ideal. Our server function just hard codes which data to fetch. What if our update function were to be called from different parts of the UI, which each needed different slices of data to be refetched? We certainly don't want to redefine our server function N times, for each such occurence.

Fortunately TanStack has the perfect feature to help reduce this coupling: Middleware. Let's remove the refetching from the server function, and move it to the simplest possible middleware. From there, let's iterate on the middleware, adding guardrails and features.

Things will get a bit complex by the end. Please don't think you need to use everything we're gonna talk about, here. In fact, for the vast majority of apps, single flight mutations probably won't matter at all.

But in going through all of this, we'll get to see some really cool TanStack features. Even if you never use them for single flight mutations, there's a very good chance they'll come in handy for something else.

## Our first middleware

TanStack Query already has a wonderful system of hierarchical keys. Wouldn't it be great if we could just have our middleware receive the query keys of what we want to refetch, and have it just ... work? Have the middleware figure out _what_ to refetch does seem tricky, at first. Sure, our queries have all been simple calls (by design) to server functions. But we can't pass a server function up to the server; functions are not serializable. How could they be? You can send strings and numbers (and booleans) across the wire, serialized as json, but sending a function (which can have with state, close over context, etc) makes no sense.

_Unless_ they're TanStack Start server functions, that is. It turns out the incredible engineers behind this project customized their serialization enginer to support server functions. To be clear, you can send a server function to the server, from the client, and it will work fine (under the covers server functions have an internal id; TanStack picks this up, sends the id, and then de-serializes the id on the other end).

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

Note the new meta section. We send over a reference to the getEpicsList, and the arg it takes. If this duplication makes you uneasy, stay tuned. We'll also update the summary query (for the counts) the same way, though that's not shown here.

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

We define the input to the middleware. The middleware we define here will automatically get _merged_ with whatever input is defined on whatever server function this middleware winds up attached to.

We define our input as optional (`config?`) since it's entirely possible we might want to call our server function and simply not refetch anything.

Now we start our client callback. This runs directly in our browser. We pull the array of query keys we want refetched.

```ts
const { refetch = [] } = data ?? {};
```

So we've passed in the query keys we want to revalidate. Now let's get our queryClient, and the cache attached to it. Then let's define the payload we want to send to the server callback of our middleware.

If you've never touched TanStack's middleware before and are feeling overwhelmed, my [middleware post](https://frontendmasters.com/blog/introducing-tanstack-start-middleware/) might be a good introduction.

```ts
const router = await getRouterInstance();
const queryClient: QueryClient = router.options.context.queryClient;
const cache = queryClient.getQueryCache();

const revalidate: RevalidationPayload = {
  refetch: [],
};
```

Our queryClient is already attached to the main TanStack router context, so we can just grab the router, and just grab it.

Remember before when we added that \_\_revalidate payload to our query options, with the server function, and arg? Let's look in our query cache for each key, and retrieve them

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

is protects us from refetches being requested for queries that don't exist. If that happens, just skip to the next one. We have no way to refetch it, if we don't have the serverFn.

Naturally you could expand the input to this middleware and send up a different payload of query keys, along with the actual refetching payload for queries you absolutely want run, even if they haven't yet been request. Perhaps you're planning on redirecting after the mutation, and you want that new page's data prefetched. We won't implement that here, but it's just a variation on this same theme. These pieces are all very composable, so build whatever you happen to need!

Anyway, let's grab that meta object, grab the properties therefrom, and put them onto the payload we'll send to the server

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

and then send it

```ts
const result = await next({
  sendContext: {
    revalidate,
  },
});
```

This line continues the middleware chain, and then runs the server function. After this line, our server function has run, and we're now back on the client. We have the result from the server function (and from the server callback of this middleware, which we'll get to).

The server callback will send back a payloads array, with entries containing a key (the query key), and result (the actual data). We loop it, and update the query data with the queryClient.

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

We immediately call next, which runs the actual server function this middleware is attached to. We pass a `payloads` array in `sendContext`. This governs what gets sent _back_ to the client callback (that's how .client got the payloads array we just saw it looping through).

Then we run through the revalidate payloads, call all the server functions, and add to that payloads array.

## Concluding thoughts

Single flight mutations are a great tool for speeding up

Happy Coding!

````

```

```
````
