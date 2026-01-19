---
title: "Single Flight Mutations in TanStack Start - Part 1"
date: "2026-01-09T10:00:00.000Z"
description: Implementing single-flight mutations using TanStack Start, and Query.
---

This is a two-part post about single flight mutations. Single flight mutation is a fancy way of saying that we mutate data, and then update the UI with just ONE round trip to the network.

The beautiful thing about implementing this with TanStack is that we can leverage the tools we already know, and love: TanStack Query (formerly react-query), TanStack Router, and Start.

If you're not familiar with these tools, TanStack Router is a client-only SPA framework, about which I wrote a three-part introduction [here](https://frontendmasters.com/blog/introducing-tanstack-router/). TanStack Start is a server layer for Router that enables things like SSR, api routes and server functions; I wrote an introduction for it [here](https://frontendmasters.com/blog/introducing-tanstack-start/), as well as a post on the middleware feature [here](https://frontendmasters.com/blog/introducing-tanstack-start-middleware/).

I've never written about TanStack Query, but it's one of the most widely used React libraries, and there are tons of resources about it.

Here in part 1 we'll cover some fundamentals, and then implement the simplest imaginable single flight mutation with a TanStack Start Server Function. Then in part 2 we'll dive deep into middleware, and implement a more serious solution, while having some fun with TypeScript in the process.

## Laying the Groundwork

In my [post on TanStack Start](https://frontendmasters.com/blog/introducing-tanstack-start/) I included this image, which is how client-driven single-page applications (SPAs) almost always behave.

![SPA](/single-flight-mutations/img1.png)

The initial request for whatever URL you're viewing returns an empty skeleton of a page. From there, more networks requests happen to fetch scripts and styles, and most likely some data, which eventually results in your actual content page being rendered.

The network round trips will almost always be the single most expensive thing your web application will do. To look at it another way, there are few things you can do to improve performance as much as _removing_ network roundtrips. And this is why server-side rendering can be so beneficial: it allows us to display content to our users _immediately_, after the initial request is responded to.

I expressed this in the Start post with this image.

![SPA](/single-flight-mutations/img2.png)

Those scripts and styles still have to load for your page to be interactive, but that initial response from the server can immediately display content for the user.

## Why Single Flight Mutations

Let's think about how you'd normally update a piece of data in a web application. You probably make a network request to some sort of `/update` endpoint, along with a post packet for whatever you're trying to change. The endpoint will probably return a success flag, possibly with the actual piece of data you just updated. Your UI will usually then request updated data. You might think that returning the updated piece of data you just changed is all you'd need in order to update the UI, but frequently that's not the case.

Imagine you're looking at a list of todo tasks, and you just edited one of them. Just updating the item on the screen isn't good enough; maybe the edit causes this TODO to no longer even be in this list, depending on your filters. Or perhaps your edit causes this TODO to be in a different location, based on your sort order. Or maybe you just _created_ a _brand new_ todo. In that case, who knows where, or even _if_ this todo will show up in your list, again based on your filters or sorts.

So we re-fetch whatever query produces our list. It usually looks like this

![SPA](/single-flight-mutations/img3.png)

This works, and if we're honest with ourselves, it's usually good enough. But can we do better? We wouldn't be good engineers if we didn't at least _try_. Conceptually we'd like to get something like this

![SPA](/single-flight-mutations/img4.png)

The rest of this post, and then part 2 will discuss increasingly flexible ways of accomplishing this.

## Our app

As with prior posts about TanStack Start and Router, this post will use our cheap, simple, and frankly ugly Jira clone. The repo for it is [here](https://github.com/arackaf/tanstack-start-single-flight-mutations-blog-post). It's a trivial app that runs on an SQLite database. The epics page looks like this

![SPA](/single-flight-mutations/img5.png)

As you can see, zero effort was put into the design. But there's a few sources of data on the screen, which will help us implement single flight mutations: the main list of epics; count of all epics (12) just above the list; and above that we have a summary list of epics, with the numbers of tasks therein.

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

As you can see, this query (and all our other queries) are just straight calls to a single server function, with the result passed through. This is a key detail that will come in handy in part 2.

## Simplest possible single flight mutation

Let's implement a dirt simple single flight mutation, and then iterate on it, to make it more and more scalable. Our main epics page has an edit button, which allows for inline editing.

![inline editing](/single-flight-mutations/img6.png)

When we hit save, let's just refetch the list of epics, as well as the epics summary data inside the edit epic server function, and send those new data down to the client, so the client can update the UI. Let's do it!

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

We save our epic, and then just fetch the updated data, from the `getEpicsList`, and `getEpicsSummary` server functions, which we call in parallel with `Promise.all` (a production-ready application would likely have some error handling...)

Now when we call our server function, the data for those queries will be attached to the result. In fact, since we're using server functions, these things will even be statically typed!

![Payloads returned](/single-flight-mutations/img6.png)

### Updating the UI

With updated data for our queries coming back after the save, we just have to insert it back into the UI. TanStack Query makes this simple. We need a reference to the QueryClient

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
  queryClient.setQueryData(["epics", "list", "summary"], result.epicsSummaryData, { updatedAt: Date.now() });

  setIsEditing(false);
};
```

If hard-coding those query keys feels gross to you, don't forget about those helper utilities we added before

```ts
queryClient.setQueryData(epicsQueryOptions(1).queryKey, result.epicsList, { updatedAt: Date.now() });
queryClient.setQueryData(epicsSummaryQueryOptions().queryKey, result.epicsSummaryData, { updatedAt: Date.now() });
```

## Iterating

Our solution works, but it's fragile; it's probably not ideal. Our server function just hard codes which data to fetch. What if our update function were to be called from different parts of the UI, which each needed different slices of data to be refetched? We certainly don't want to redefine our server function N times, for each place it needs to be called.

Fortunately TanStack has the perfect feature to help reduce this coupling: Middleware. We can remove the refetching from the server function, and move it to a reusable middleware, that can be attached to server function

Tune in to part 2 where we'll dive into all of this.

## Concluding thoughts

Stay tuned for part 2 where we'll build middleware to handle all of this in a flexible, scalable manner.
