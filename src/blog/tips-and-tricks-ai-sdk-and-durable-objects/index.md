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

Have a look at this type

```ts
export type SessionPayload =
  | { status: "not-found" }
  | { status: "error" }
  | {
      status: "loaded";
      session: typeof session.$inferSelect;
      prompts: PromptPayload[];
    };
```

and this Durable Object method that returns that type

```ts
loadSession(sessionId: number): SessionPayload {
  try {
    const session = this.db.select().from(sessionTable).where(eq(sessionTable.id, sessionId)).get();
    if (!session) {
      return { status: "not-found" };
    }
    const promptsRaw = this.#queryPrompts(eq(sessionPromptTable.sessionId, sessionId)).all();

    const prompts: PromptPayload[] = promptsRaw.map(payload =>
      this.#transformQueriedPromptResult(sessionId, payload),
    );
    return { status: "loaded", session: session, prompts };
  } catch (error) {
    return { status: "error" };
  }
}
```

Just having a TanStack Server Function attempt to call, and return this value:

```ts
export const loadAiSessionServerFn = createServerFn({ method: "POST" })
  .inputValidator((payload: { sessionId: number }) => payload)
  .middleware([withWtDo])
  .handler(async ({ data, context }) => {
    return context.wtDo.loadSession(data.sessionId);
  });
```

produces a horrendous TypeScript error

```
 Argument of type '({ data, context }: ServerFnCtx<Register, "POST", readonly [FunctionMiddlewareAfterServer<Register, unknown, undefined, { wtDo: DurableObjectStub<WorkoutTemplateAIGenerationDO>; }, undefined, undefined, undefined>], (payload: { ...; }) => { ...; }>) => Promise<...>' is not assignable to parameter of type 'ServerFn<Register, "POST", readonly [FunctionMiddlewareAfterServer<Register, unknown, undefined, { wtDo: DurableObjectStub<WorkoutTemplateAIGenerationDO>; }, undefined, undefined, undefined>], (payload: { ...; }) => { ...; }, Promise<...>, true>'.
  Type 'Promise<({ status: "not-found"; } & Disposable) | ({ status: "error"; } & Disposable) | ({ status: "loaded"; session: { id: number; createdAt: string; name: string; }; prompts: { ...; }[]; } & Disposable)>' is not assignable to type 'Promise<ValidateSerializableMapped<{ status: "not-found"; } & Disposable, RegisteredSerializableInput<Register>> | ValidateSerializableMapped<...> | ValidateSerializableMapped<...>>'.
    Type '({ status: "not-found"; } & Disposable) | ({ status: "error"; } & Disposable) | ({ status: "loaded"; session: { id: number; createdAt: string; name: string; }; prompts: { ...; }[]; } & Disposable)' is not assignable to type 'ValidateSerializableMapped<{ status: "not-found"; } & Disposable, RegisteredSerializableInput<Register>> | ValidateSerializableMapped<...> | ValidateSerializableMapped<...>'.
      Type '{ status: "not-found"; } & Disposable' is not assignable to type 'ValidateSerializableMapped<{ status: "not-found"; } & Disposable, RegisteredSerializableInput<Register>> | ValidateSerializableMapped<...> | ValidateSerializableMapped<...>'.
        Type '{ status: "not-found"; } & Disposable' is not assignable to type 'ValidateSerializableMapped<{ status: "not-found"; } & Disposable, RegisteredSerializableInput<Register>>'.
          Types of property '[Symbol.dispose]' are incompatible.
            Type '() => void' is not assignable to type 'SerializationError<"Function may not be serializable">'.
```

I'll be honest, I'm not even sure why this error happened. I suspect the Union type (my `SessionPayload` type) being intersected with the Disposable type produced something slightly unexpected. But more importantly I _don't care_ exactly why this broke. The Disposable type is actually adding friction now, so let's just get rid of it.

### Attempt 1

You might think something like this would be a nifty helper

```ts
export function doStrip<T>(value: T): Omit<T, typeof Symbol.dispose> {
  return value;
}
```

Take in some type, and just strip off the undesired pieces. You pass the value through this function to "clean" the type of Symbol.dispose (which is what the Disposable type adds). Unfortunately, `Omit<T, typeof Symbol.dispose>` doesn't distribute over the union type that we saw before

But TypeScript has a special type for which distributing over unions is a core feature: conditional types.

### Attempt 2

Once we realize that conditional types are how we distribute over unions and intersections we might try something like this

```ts
type StripDisposable<T> = T extends unknown ? Omit<T, typeof Symbol.dispose> : never;

export function doStrip<T>(value: T): StripDisposable<T> {
  return value as StripDisposable<T>;
}
```

and then use it like this

```ts
export const loadAiSessionServerFn = createServerFn({ method: "POST" })
  .validator((payload: { sessionId: number }) => payload)
  .middleware([withWtDo])
  .handler(async ({ data, context }) => {
    return doStrip(await context.wtDo.loadSession(data.sessionId));
  });
```

### The real solution

The real way of solving this is to just add a return type to your server function.

Normally with TypeScript relying in type inference is perfectly acceptable, and frankly preferred the overwhelming majority of the time. But here, annotating the return type we want

```ts
export const loadAiSessionServerFn = createServerFn({ method: "POST" })
  .validator((payload: { sessionId: number }) => payload)
  .middleware([withWtDo])
  .handler(async ({ data, context }): Promise<SessionPayload> => {
    return context.wtDo.loadSession(data.sessionId);
  });
```

And that's that. The Disposable type is still returned from the Durable Object. But that value, with the Disposable cruft, is still _assignable to_ our return type, and anything calling into our server function will now get back solely our declared return type.

Exactly whay we

## Parting thoughts

Cloudflare's Durable Objects is one of my favorite infrastructure primitives around. The built-in storage, and web socket support make it a superb tool for a surprising number of use cases. And TanStack Start has been my preferred web framework for as long as I care to remember.

Hopefully this post had some useful tips for getting the most out of those tools, especially when used together!

Happy Coding!
