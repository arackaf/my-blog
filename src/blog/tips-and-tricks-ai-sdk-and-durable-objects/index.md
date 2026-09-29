---
title: Tips and tricks for using TanStack Start with Cloudflare Durable Objects
date: "2026-09-28T20:00:32.169Z"
description:
---

I've previously written about Cloudflare's [Durable Objects](https://blog.master.dev/durable-objects-on-cloudflare/), and I've written about TanStack Start too many times to list here.

This post is about some of the tips and tricks I've come across using them together. A _few_ of these tips are solutions to problems that may be solved in TanStack by the time you read this. But most, like utilizing Middleware and tagged web socket connections are just making the most of great features.

Let's get started!

## Middleware to simplify DO creation

Durable Objects can only be called from the server, not from the browser. A Durable Object is not a publicly addressable resource on the internet; it's an internal resource that can only be connected to from within Cloudflare infra. But since our web app is (presumably) running within Cloudflare, we can absolutely connect to it from server-side code in our web app. (if your web app is hosted on a vanilla Node process, or on Vercel, Durable Objects may not be a great tool to lean on).

In prior posts I've shown code like this for getting an instance of the Durable Object.

```ts
export const getWorkoutTemplateAIGenerationDurableObject = async (context: AuthContext) => {
  const userId = await requireUserId(context);
  const { WorkoutTemplateAIGenerationDO } = env;
  const doId = WorkoutTemplateAIGenerationDO.idFromName(userId);
  return WorkoutTemplateAIGenerationDO.get(doId);
};
```

which _could_ be used like this

```
//TODO: Chris - make sure this has TS formatting - I shut it off to prevent Prettier from formatting this code snippet badly
export const getAiSessionsServerFn = createServerFn({ method: "POST" })
  .handler(async ({ context }): Promise<SessionSummary[]> => {
    const wtDo = await getWorkoutTemplateAIGenerationDurableObject(context);
    return wtDo.getSessions();
  });
```

But what if the call site of `getWorkoutTemplateAIGenerationDurableObject` were to change in some way. We wouldn't want to have to update every single call site which uses this method. Yes, of course an agent would make such a refactor trivial. Nonetheless, there's a TanStack feature that's built for this kind of thing: [Middleware](https://tanstack.com/start/latest/docs/framework/react/guide/middleware).

### First attempt

```ts
const withWtDo = createMiddleware({ type: "function" }).server(async ({ context, next }) => {
  const durableObject = await getWorkoutTemplateAIGenerationDurableObject(context);
  return next({
    context: {
      wtDo: durableObject,
    },
  });
});
```

Unfortunately this creates TS errors, since context is undefined. This was a surprise since I'm using [Global Middleware](https://tanstack.com/start/latest/docs/framework/react/guide/middleware#global-middleware) to add authentication info, so it would automatically be available everywhere.

This is currently a limitation with TanStack's static typings; but there's an easy workaround.

### The solution

When we created global middleware we did so in `start.ts` at the root of our project. Inside of that we have this export (this is all covered in the linked docs above)

```ts
export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware, globalContextMiddleware, errorLoggingMiddleware],
  functionMiddleware: [],
}));
```

As of now, middleware can't pick up things added to context in global middleware like, as I'm doing here with `globalContextMiddleware`.

The workaround, for now, is to just import that very same `startInstance`, and then simply call `createMiddleware` off of `startInstance`

```ts
export const withWtDo = startInstance.createMiddleware({ type: "function" }).server(async ({ context, next }) => {
  const durableObject = await getWorkoutTemplateAIGenerationDurableObject(context);
  return next({
    context: {
      wtDo: durableObject,
    },
  });
});
```

which works like a charm.

Now we can simply add the middleware to our server functions.

```ts
export const getAiSessionsServerFn = createServerFn({ method: "POST" })
  .middleware([withWtDo])
  .handler(async ({ context }): Promise<SessionSummary[]> => {
    return context.wtDo.getSessions();
  });
```

And our Durable Object instance will be available and waiting for us in context.

## Tagged WebSocket connections

Durable Objects have built-in WebSocket support. I've covered this in my other posts, but the short of it is, to accept and create a new WebSocket connection, you add a fetch method like so

```ts
  fetch(request: Request): Response {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", {
        status: 426,
      });
    }

    // ...

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    this.ctx.acceptWebSocket(server);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
```

And then, to send out a message to all WebSocket connections, you do something like this

```ts
  sendMessage(sessionId: number, payload: Object) {
    for (const socket of this.ctx.getWebSockets()) {
      try {
        socket.send(JSON.stringify(payload));
      } catch {
        // The socket may have disconnected before Cloudflare observed it.
        socket.close(1011, "Unable to send message");
      }
    }
  }
```

### Filtering WebSocket connections

But what if you want to separate or categorize WebSocket connections? In my prior post I wrote about using AI to generate workouts. When the user input a prompt, I called methods in my Durable Object to save that to a new session, then open a WebSocket connection for prompt results.

But what if the user has multiple sessions open at once. If a single session's prompt results come back, when we do this

```ts
for (const socket of this.ctx.getWebSockets()) {
  try {
    socket.send(JSON.stringify(payload));
  } catch {
    // The socket may have disconnected before Cloudflare observed it.
    socket.close(1011, "Unable to send message");
  }
}
```

We'll wind up sending that prompt update to all sessions, even ones this does not apply to. Sure we could add code to check, and ignore irrelevant messages, but there's a cleaner, more direct solution: tagged WebSocket connections.

### Tagging WebSocket connections

When we create (accept) a WebSocket connection, we have the option of providing one or more tags. These allow us to, well, "tag" a WebSocket connection; and we can use these tags for subsequent retrieval.

For the AI workout generation example I just mentioned, when a new WebSocket connection is created, I include the sessionId in the URL that's used for setting up new connections. Remember, we have to set up our own API route, and then manually call the `fetch` method on our Durable Object, and pass in the raw request object. That raw request object has the original url, and you can set up whatever url for your API route you'd like. For mine, I included the sessionId as a route param.

```ts
fetch(request: Request): Response {
  if (request.headers.get("Upgrade") !== "websocket") {
    return new Response("Expected WebSocket", {
      status: 426,
    });
  }

  const url = new URL(request.url);
  const sessionIdParam = url.pathname.split("/").at(-2) || "";
```

And then, when we call `acceptWebSocket` we can pass in a tag

```ts
this.ctx.acceptWebSocket(server, [webSocketTag(sessionId)]);
```

`webSocketTag` is just a simple function that takes in a sessionId and returns back a string tag. Mine is simply this

Mine is simply this

```ts
const webSocketTag = (sessionId: number) => `session:${sessionId}`;
```

Why would I bother with a function for something so simple? Because I also use that _same_ tag to _retrieve_ WebSockets when I want to _send_ a message, which I do like this

```ts
sendMessage(sessionId: number, payload: Object) {
  for (const socket of this.ctx.getWebSockets(webSocketTag(sessionId))) {
    try {
      socket.send(JSON.stringify(payload));
    } catch {
      // The socket may have disconnected before Cloudflare observed it.
      socket.close(1011, "Unable to send message");
    }
  }
}
```

And with that, a given WebSocket only receives messages it cares about.

## Return Types, Durable Object and Server Functions

Here's a Durable Object method

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

The inferred return type of this method is

```ts
{
  id: number;
  name: string;
  createdAt: string;
}
[];
```

And here's our Server Function we use to call it

```ts
export const getAiSessionsServerFn = createServerFn({ method: "POST" })
  .middleware([withWtDo])
  .handler(async ({ context }) => {
    return context.wtDo.getSessions();
  });
```

the inferred return type is this

```ts
Promise<{
    id: number;
    name: string;
    createdAt: string;
}[] & Disposable
```

note the `& Disposable`. The array of objects with `id`, `name`, etc is what comes back from the query. `Disposable` gets added on behind the scenes, as does `Promise<T>` wrapping the whole thing.

What may be especially surprising is that setting a return type on the DO's method does not change this

```ts
getSessions(): SessionSummary[] {
  const rows = this.db.select().from(sessionTable).all();
  return rows;
}
```

The return type of the server function which calls the Durable Object's function is still

```ts
Promise<
  {
    id: number;
    name: string;
    createdAt: string;
  }[] &
    Disposable
>;
```

The Durable Object result is _still_ getting that ``Disposable` added on. Remember, we don't instantiate the Durable Object's class directly; instead, we always go through this to create a proxy to the DO.

```ts
const { WorkoutTemplateAIGenerationDO } = env;
const doId = WorkoutTemplateAIGenerationDO.idFromName(userId);
return WorkoutTemplateAIGenerationDO.get(doId);
```

Those utilities wrap the Durable Object, and handle the network boilerplate for making requests. That's what's taking our actual return types, and tacking on `Disposable`; and for that matter, wrapping return types with `Promise`.

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

Just having a TanStack Server Function attempt to call, and return this method:

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

Take in some type, and just strip off the undesired pieces. You pass the value through this function to "clean" the type of Symbol.dispose (which is what the Disposable type adds).

When we do

```ts
export const loadAiSessionServerFn = createServerFn({ method: "POST" })
  .validator((payload: { sessionId: number }) => payload)
  .middleware([withWtDo])
  .handler(async ({ data, context }) => {
    return doStrip(await context.wtDo.loadSession(data.sessionId));
  });
```

the return type is now inferred as

```ts
Omit<
  | ({
      status: "not-found";
    } & Disposable)
  | ({
      status: "error";
    } & Disposable)
  | ({
      status: "loaded";
      session: {
        id: number;
        createdAt: string;
        name: string;
      };
      prompts: {
        //.......
      };
    } & Disposable),
  typeof Symbol.dispose
>;
```

which is not at all what we wanted.

The problem is, `Omit<T, typeof Symbol.dispose>` doesn't distribute over the union type that we saw before.

But TypeScript has a special type for which distributing over unions is a core feature: conditional types.

### Attempt 2

Once we realize that conditional types are how we distribute over unions we might try something like this

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

This works, essentially. Unfortunately the type is reported as

```ts
Omit<
  {
    status: "not-found";
  } & Disposable,
  typeof Symbol.dispose
> |
  Omit<
    {
      status: "error";
    } & Disposable,
    typeof Symbol.dispose
  > |
  Omit<
    {
      status: "loaded";
      session: {
        id: number;
        createdAt: string;
        name: string;
      };
      prompts: {};
    } & Disposable,
    typeof Symbol.dispose
  >;
```

It's ugly but correct. But let's take a step back.

### The real solution

The real way of solving this is to just add a return type to your server function.

Normally with TypeScript relying on type inference is perfectly acceptable, and frankly **preferred** the overwhelming majority of the time. But here, we simply annotate the return type we want

```ts
export const loadAiSessionServerFn = createServerFn({ method: "POST" })
  .validator((payload: { sessionId: number }) => payload)
  .middleware([withWtDo])
  .handler(async ({ data, context }): Promise<SessionPayload> => {
    return context.wtDo.loadSession(data.sessionId);
  });
```

And that's that. The Disposable type is still returned from the Durable Object. But that value, with the Disposable cruft, is still _assignable to_ our return type, and anything calling into our server function will now get back solely our declared return type.

Exactly what we want.

## Parting thoughts

Hopefully this post contained some useful tidbits for using Durable Objects effectively with TanStack Start.

Happy Coding!
