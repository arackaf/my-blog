---
title: Making the most of Vercel's AI SDK with Cloudflare Durable Objects
date: "2026-09-15T20:00:32.169Z"
description:
---

I've previously written about [Vercel's AI SDK and AI Gateway](https://blog.master.dev/having-fun-with-vercels-ai-sdk-and-ai-gateway/). That post covered the basics of setting up an account in the AI Gateway (or directly in a provider of your choice), and making requests against an AI model while constraining the structure of the data it sent back, to ensure you could use it in your application: if your database is expecting a field called `weight`, things won't work well if the LLM sends back that data in a field called `bodyweight`.

That post used an existing fitness tracker app I've been toying with. It set up a rudimentary UI for the user to provide the LLM with some reference workouts, and a prompt to produce new workouts. The AI SDK was sent the prompt, the reference workouts, and a list of all exercises; it sent back some commentary, along with the generated workouts. To keep things simple I set up a basic modal that simply showed a spinner while the request was being processed (which usually takes about 30 seconds, or even more). When the request finished, the workouts displayed, along with a save button if the user wanted to save them into their account.

The limitations of this UX should be obvious. If the user refreshed the page while the request was in flight, everything would be lost. If the user even refreshed the page after those results were in the modal, they'd also be lost. Granted, the latter is easily fixed: we could save those results into our own database for later recall. But this post will wrap everything together into one cohesive UI with one of my favorite infrastructure primitives: Cloudflare Durable Objects.

## Why Durable Objects

I previously wrote about Durable Objects [here](https://blog.master.dev/durable-objects-on-cloudflare/). The elevator pitch for DOs is that they're like a regular Cloudflare Worker, except instead of being ephemeral, and spun up quickly to serve a request before dying off, they come with persistent storage (SQLite), and even have built-in WebSocket support. Oh and as the name implies, they're durable. They're expected to be long-lived, and hibernate (without cost) when not in use.

You define a DO with a class, and then instantiate it with whatever unique IDs you want (one per user, or whatever you can imagine). Each one you spin up has its own dedicated SQLite database, and collection of WebSocket connections.

This provides us all the missing primitives we need. When the user hits the "Generate" button to run their prompt, we run it _on_ the durable object, and save it to SQLite. When the request is finished, we again save it (in SQLite) and then use a WebSocket to _push_ the result to the user's browser. And if the user refreshes the page, we can hit up that same DO and ask it to query its SQLite db for current prompts, past prompts, etc.

I obviously won't show every line of code, but the repo is [here](https://github.com/arackaf/fitness-tracker). This is currently a work in progress in the feature/ai-workout-template-generation branch, but of course by the time you read this it might be in Main.

Let's get started.

## Our Durable Object definition

Here's an initial, incomplete segment of our Durable Object; the whole thing is about 250 lines, so we'll just show the important concepts.

```ts
export class WorkoutTemplateAIGenerationDO extends DurableObject {
  db: DrizzleSqliteDODatabase;
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);

    ctx.blockConcurrencyWhile(async () => {
      ctx.storage.sql.exec(initialWorkoutTemplateDDL);
    });

    this.db = drizzle(ctx.storage);
  }
}
```

I like to use Drizzle for my data access. It's basically a TypeScript API that very closely mirrors actual SQL, but with auto-complete and static typings to help prevent invalid queries. That's what this declares `db: DrizzleSqliteDODatabase;`

In the constructor I use the `ctx.blockConcurrencyWhile` helper to essentially lock this DO until the code in the callback is finished. This ensures the current DO will run my SQL migration script, if needed, and prevent any other requests from running while the DB is in an inconsistent state. I put it in the constructor, so it runs every time a Durable Object instance is created, or re-created from hibernation. The DDL is therefore structured with things like `CREATE TABLE IF NOT EXISTS` to only create schema objects if they're not there already.

Then I instantiate the drizzle object.

## Setting up our WebSocket

I covered this in detail in my prior [Durable Objects post](https://blog.master.dev/durable-objects-on-cloudflare/), but to accept and set up WebSocket connections you need a fetch method which takes the raw request, inside of which we call some built-in Cloudflare utilities to establish, and save the connection.

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

}
```

### Sending WebSocket messages

To get all open sockets for this durable object, we call `this.ctx.getWebSockets()` and use the `send` method accordingly.

```ts
sendMessage(payload: Object) {
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

Simple and humble.

### Connecting to the durable object's WebSocket

If you're curious how to get a raw connection into the DO, so we can establish a WebSocket connection, the trick is to use what most meta-frameworks call an API route (and which TanStack calls a server route). You establish your connection to _that_, and that API route simply forwards (proxies) the request to the Durable Object.

```ts
import { getWorkoutTemplateAIGenerationDurableObject } from "@/durable-objects/WorkoutTemplateAIGeneration/do";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/app/admin/workout-templates/ai/$id/subscribe")({
  server: {
    handlers: {
      GET: async ({ request, context }) => {
        const cart = await getWorkoutTemplateAIGenerationDurableObject(context);
        return cart.fetch(request);
      },
    },
  },
});
```

along with a bit of helper code to send the request to the right place, no matter whether you're in production or development mode.

```ts
export function openWorkoutTemplateWebSocket(sessionId: string, lastPromptId?: number) {
  return new Promise<WebSocket>((res, rej) => {
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";

    const socket = new WebSocket(
      `${protocol}//${location.host}/app/admin/workout-templates/ai/${sessionId}/subscribe${lastPromptId ? `?lastPromptId=${lastPromptId}` : ""}`,
    );

    socket.addEventListener("open", () => {
      res(socket);
    });

    socket.addEventListener("error", event => {
      rej(event);
    });
  });
}
```

## Running prompts and saving data

When the user wants to run a prompt, we can save a new session into our SQLite database.

```ts
createSession(promptInfo: PromptInput): { id: number } {
  const result = this.db
    .insert(sessionTable)
    .values({
      name: "",
      createdAt: new Date().toISOString(),
    })
    .returning({ id: sessionTable.id })
    .all();

  const sessionId = result[0].id;

  // ...

  this.prompt(promptInfo)
    .then(promptResult => {
      // ...
    })
    .catch(() => {
      // ...
    })
    .finally(() => {
      this.sendUpdateForPromptId(sessionId, sessionPromptId);
    });

  return result[0];
}
```

The `prompt` method being called here is what interacts directly with the Vercel AI SDK.

```ts
export class WorkoutTemplateAIGenerationDO extends DurableObject {
  // ...
  async prompt(input: PromptInput): Promise<PromptResult> {
    const { workoutTemplates, prompt, exercises, model = "anthropic/claude-sonnet-4.6" } = input;

    try {
      const { output, usage, finalStep } = await generateText({
        instructions: systemPrompt(workoutTemplates, exercises),
        model,
        prompt: userPrompt(prompt, workoutTemplates),
        // ...
      });

      // ....
    } catch (err) {}
  }
}
```

See my [prior post](https://blog.master.dev/having-fun-with-vercels-ai-sdk-and-ai-gateway/) on the SDK for more details.

I'm deliberately leaving out some code, and in fact I'm probably showing too much. Really just understand how these pieces fit together, and build whatever UI and workflow works best for you.

## Reading data

The `getSessions` method is an example of fetching data from our SQLite instance, to return back to our UI. Here we can pull up all sessions the user has ever started (whether in progress or complete). Note the lack of async or await; the SQLite API is synchronous, which is especially nice. Note also the lack of filters based on the current user.

```ts
getSessions() {
  const rows = this.db.select().from(sessionTable).all();
  return rows;
}
```

If you recall, we create instances of these durable objects _per user_, based on their userId from our authentication layer. This means each user's DO has _its own SQLite database_, and we can simply dump the table to get all sessions, or delete sessions at will. The user has access to everything in the Durable Object's DB because of how we've chosen to instantiate them. To access someone else's data they'd have to gain access to someone else's Durable Object, which they could only do by breaking our own authentication mechanism, in which case we'd have bigger problems!

## Interacting with our Durable Object

We can only call methods on our Durable Object from the server, not the browser. So if you're using TanStack, like I am, we'll need some server functions. First, here's a helper to get a connection to a given user's durable object.

```ts
export const getWorkoutTemplateAIGenerationDurableObject = async (context: AuthContext) => {
  const userId = await requireUserId(context);
  const { WorkoutTemplateAIGenerationDO } = env;
  const doId = WorkoutTemplateAIGenerationDO.idFromName(userId);
  return WorkoutTemplateAIGenerationDO.get(doId);
};
```

and then a server function interacting with our durable object might look something like this.

```ts
export const loadAiSessionServerFn = createServerFn({ method: "POST" })
  .validator((payload: { sessionId: number }) => payload)
  .handler(async ({ data, context }): Promise<SessionPayload> => {
    const durableObject = await getWorkoutTemplateAIGenerationDurableObject(context);
    return durableObject.loadSession(data.sessionId);
  });
```

## Putting it all together

Once you understand how these pieces fit together you can clearly instruct your preferred agent and harness of choice to build whatever UX and workflow you'd like.

Mine looks something like this. The main page, which allows you to prompt for new workout templates to be created, along with links to prior prompting sessions.

![project setup](/ai-sdk-with-durable-objects/img-01-main-page.jpg)

After we fill out our prompt and hit generate, we call a server function, which calls into our durable object to create the session, start the prompt, and then _immediately_ returns back the session id (without waiting for the prompt).

With the session id I then redirect to a page for that dedicated session. That page has the session id in the URL, and I use it to load the full prompt and response history for that session, as well as set up a WebSocket connection.

![project setup](/ai-sdk-with-durable-objects/img-03a-session-waiting.jpg)

In the session in the screenshot above, we're still waiting on the prompt response from the AI model. When that finally comes in, the WebSocket sends the update, and we update the UI.

![project setup](/ai-sdk-with-durable-objects/img-03b-results.jpg)

I display the response from the model, as well as the proposed workouts. Since I'm using a Zod schema to force these workout templates to be in the same structure used by the rest of this application, I can put them directly into the same form components I usually use for letting the user set up their own workout templates manually.

![project setup](/ai-sdk-with-durable-objects/img-03c-results-save-button.jpg)

When the user hits the save button, I use the save endpoints I already have, notify the durable object that that workout has been saved, and then in the future I display it in my other existing component, for read-only display of workout templates.

![project setup](/ai-sdk-with-durable-objects/img-03d-results-template-saved.jpg)

## Wrapping up

I hope I've done a good job of showing why Cloudflare's Durable Objects are such a good fit for managing long-running ai sessions. To be clear, their feature sets make them a great fit for a _ton_ of use cases. Durable Objects come with

\- Dedicated SQLite storage scoped to each individual DO instance you choose to create

\- Built-in WebSocket support

\- All the normal benefits Cloudflare Workers offer, like low latency

In this post we put those features together to build a feature that tracks AI prompts. We stored the prompts and results in SQLite, and pushed results as they came in down to the user via the built-in WebSocket functionality.

## Parting thoughts

Vercel's AI SDK is a great tool for making model-agnostic requests. I've found Cloudflare's Durable Objects to be a fantastic feature for making the most of it. From its dedicated storage to its built-in WebSocket support, it has tons of features that make implementing real use cases as straightforward as possible.

Happy coding!
