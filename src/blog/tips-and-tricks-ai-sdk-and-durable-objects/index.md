---
title: Tips and tricks for using TanStack Start with Cloudflare Durable Objects
date: "2027-09-05T20:00:32.169Z"
description:
---

Let's get started.

## Return Types, Durable Object and Server Functions

So here's our Durable Object method

```ts
export class WorkoutTemplateAIGenerationDO extends DurableObject {
  // ...
  getSessions() {
    const rows = this.db.select().from(sessionTable).all();
    return rows;
  }
  // ...
}
```

And here's our Server Function we use to call it

```ts
export const getAiSessionsServerFn = createServerFn({ method: "POST" })
  .middleware([withWtDo])
  .handler(async ({ context }) => {
    return context.wtDo.getSessions();
  });
```

return type is this

```
{
    id: number;
    createdAt: string;
    name: string;
}[] & Disposable
```

note the `& Disposable`.

What may be especially surprising is that setting a return type on the DO's method does not change this

```ts
getSessions(): SessionSummary[] {
  const rows = this.db.select().from(sessionTable).all();
  return rows;
}
```

The return type of the server function which calls the Durable Object's function is still

```ts
const aiSessions: {
  id: number;
  createdAt: string;
  name: string;
}[] &
  Disposable;
```

Remember, we don't instantiate the Durable Object's class directly; instead, we always go through this

```ts
const { WorkoutTemplateAIGenerationDO } = env;
const doId = WorkoutTemplateAIGenerationDO.idFromName(userId);
return WorkoutTemplateAIGenerationDO.get(doId);
```

That utilities wraps the Durable Object, and handles the network boilerplate for making request. That's what's taking our actual return types and tacking on `Disposable`; and for that matter, wrapping with `Promise`.

### Is this a problem?

Maybe, or maybe not. For this particular example you can probably just ignore the Disposable and everything will probably work.

This produces no errors

```ts
const { data: aiSessions } = useSuspenseQuery(getAiSessionsQueryOptions());

const arr: SessionSummary[] = aiSessions;
```

aiSessions is of type

```ts
{
  id: number;
  createdAt: string;
  name: string;
}
[] & Disposable;
```

But thanks to the way TS's structural typing works, we can absolutely assign that to `SessionSummary[]`; the Disposable part is just ignored.

But let's take a look at a different example.

### When the added on Disposable type gets in the way

### Attempt 1

You might think something like this would be a nifty helper

```ts
export function doStrip<T>(value: T): Omit<T, typeof Symbol.dispose> {
  return value;
}
```

You might imagine you could just pass the value through this function to "clean" the type of the value. Unfortunately, `Omit<T, typeof Symbol.dispose>` doesn't distribute over the intersection type that we saw before

```
{
    id: number;
    createdAt: string;
    name: string;
}[] & Disposable
```

### Attempt 2

Once we realize that conditional types are how we distribute over unions and intersections we might try something like this

```ts
type StripDisposable<T> = T extends unknown ? Omit<T, typeof Symbol.dispose> : never;

export function doStrip<T>(value: T): StripDisposable<T> {
  return value as StripDisposable<T>;
}
```

and then use it like this

## Parting thoughts

Cloudflare's Durable Objects is one of my favorite infrastructure primitives around. The built-in storage, and web socket support make it a superb tool for a surprising number of use cases. And TanStack Start has been my preferred web framework for as long as I care to remember.

Hopefully this post had some useful tips for getting the most out of those tools, especially when used together!

Happy Coding!
